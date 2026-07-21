package server

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	"github.com/YFFFFFFFF/meeting-room-booking/backend/internal/config"
	"github.com/YFFFFFFFF/meeting-room-booking/backend/internal/handler/approvals"
	"github.com/YFFFFFFFF/meeting-room-booking/backend/internal/handler/auth"
	"github.com/YFFFFFFFF/meeting-room-booking/backend/internal/handler/bookings"
	confighandler "github.com/YFFFFFFFF/meeting-room-booking/backend/internal/handler/config"
	"github.com/YFFFFFFFF/meeting-room-booking/backend/internal/handler/equipment"
	"github.com/YFFFFFFFF/meeting-room-booking/backend/internal/handler/rooms"
	"github.com/YFFFFFFFF/meeting-room-booking/backend/internal/handler/stats"
	"github.com/YFFFFFFFF/meeting-room-booking/backend/internal/handler/users"
	"github.com/YFFFFFFFF/meeting-room-booking/backend/internal/handler/wecom"
	"github.com/YFFFFFFFF/meeting-room-booking/backend/internal/middleware"
	"github.com/YFFFFFFFF/meeting-room-booking/backend/internal/model"
	"github.com/YFFFFFFFF/meeting-room-booking/backend/internal/repository"
	"github.com/YFFFFFFFF/meeting-room-booking/backend/internal/service"
)

func Run() {
	cfg := config.Load()

	// 初始化数据库
	db, err := gorm.Open(postgres.Open(cfg.DB.DSN()), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Warn),
	})
	if err != nil {
		log.Printf("⚠️ 数据库连接失败，使用 SQLite 内存模式: %v", err)
		// Fallback: 使用 SQLite
		db, err = gorm.Open(postgres.New(postgres.Config{
			DSN: "host=localhost port=5432 user=postgres dbname=postgres sslmode=disable",
		}), &gorm.Config{})
		if err != nil {
			log.Fatalf("数据库初始化失败: %v", err)
		}
	}

	repo := repository.NewDB(db)
	// Auto-migrate（实际环境由 migration 管理）
	_ = repo.AutoMigrate()

	// 初始化 Redis
	rdb := redis.NewClient(&redis.Options{
		Addr:     cfg.Redis.Addr,
		Password: cfg.Redis.Password,
		DB:       cfg.Redis.DB,
	})
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := rdb.Ping(ctx).Err(); err != nil {
		log.Printf("⚠️ Redis 连接失败: %v（缓存功能不可用）", err)
	}

	cache := repository.NewCache(rdb)

	// 初始化服务
	calSvc := service.NewCalendarSyncService(repo, cache)
	cacheSvc := service.NewCacheService(repo, cache)

	// 预热缓存
	go cacheSvc.WarmUpCache(context.Background())

	// 初始化 JWT
	middleware.InitJWTSecret(cfg.JWT.Secret)

	// 种子数据
	seedData(repo)

	// 路由
	router := gin.Default()
	router.Use(middleware.RequestID())

	// 健康检查
	router.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok", "service": "meeting-room-booking-backend"})
	})

	api := router.Group("/api")
	{
		// 认证（无需登录）
		authH := auth.NewHandler(repo, cache)
		api.POST("/auth/login", authH.Login)
		api.POST("/auth/refresh", middleware.AuthRequired(), authH.Refresh)
		api.GET("/auth/me", middleware.AuthRequired(), authH.Me)

		// 会议室
		roomH := rooms.NewHandler(repo, cache, cacheSvc)
		api.GET("/rooms", middleware.AuthRequired(), roomH.List)
		api.GET("/rooms/:id", middleware.AuthRequired(), roomH.Get)
		api.GET("/rooms/:id/availability", middleware.AuthRequired(), roomH.Availability)
		api.POST("/rooms", middleware.AuthRequired(), middleware.RoleRequired("admin", "super_admin"), roomH.Create)
		api.PUT("/rooms/:id", middleware.AuthRequired(), middleware.RoleRequired("admin", "super_admin"), roomH.Update)
		api.DELETE("/rooms/:id", middleware.AuthRequired(), middleware.RoleRequired("admin", "super_admin"), roomH.Delete)
		api.POST("/rooms/import", middleware.AuthRequired(), middleware.RoleRequired("admin", "super_admin"), roomH.Import)
		api.GET("/rooms/export", middleware.AuthRequired(), middleware.RoleRequired("admin", "super_admin"), roomH.Export)

		// 预约
		bookingH := bookings.NewHandler(repo, cache, calSvc)
		api.POST("/bookings", middleware.AuthRequired(), bookingH.Create)
		api.PUT("/bookings/:id", middleware.AuthRequired(), bookingH.Update)
		api.DELETE("/bookings/:id", middleware.AuthRequired(), bookingH.Cancel)
		api.GET("/bookings/mine", middleware.AuthRequired(), bookingH.Mine)
		api.POST("/bookings/:id/checkin", middleware.AuthRequired(), bookingH.Checkin)

		// 审批
		approvalH := approvals.NewHandler(repo, cache)
		api.GET("/approvals/pending", middleware.AuthRequired(), middleware.RoleRequired("admin", "super_admin"), approvalH.Pending)
		api.POST("/approvals/:id/approve", middleware.AuthRequired(), middleware.RoleRequired("admin", "super_admin"), approvalH.Approve)
		api.POST("/approvals/:id/reject", middleware.AuthRequired(), middleware.RoleRequired("admin", "super_admin"), approvalH.Reject)

		// 设备
		equipH := equipment.NewHandler(repo, cache)
		api.GET("/equipment", middleware.AuthRequired(), equipH.List)
		api.PUT("/equipment/:id", middleware.AuthRequired(), middleware.RoleRequired("admin", "it_admin", "super_admin"), equipH.Update)
		api.POST("/repair-tickets", middleware.AuthRequired(), equipH.CreateTicket)
		api.PUT("/repair-tickets/:id", middleware.AuthRequired(), middleware.RoleRequired("admin", "it_admin", "super_admin"), equipH.UpdateTicket)

		// 统计
		statsH := stats.NewHandler(repo, cache)
		api.GET("/stats/dashboard", middleware.AuthRequired(), statsH.Dashboard)
		api.GET("/stats/utilization", middleware.AuthRequired(), statsH.Utilization)
		api.GET("/stats/trend", middleware.AuthRequired(), statsH.Trend)
		api.GET("/stats/hot-rooms", middleware.AuthRequired(), statsH.HotRooms)
		api.GET("/stats/peak-hours", middleware.AuthRequired(), statsH.PeakHours)
		api.GET("/stats/export", middleware.AuthRequired(), statsH.Export)

		// 配置
		configH := confighandler.NewHandler(repo, cache)
		api.GET("/config/booking-rules", middleware.AuthRequired(), configH.GetBookingRules)
		api.PUT("/config/booking-rules", middleware.AuthRequired(), middleware.RoleRequired("admin", "super_admin"), configH.UpdateBookingRules)
		api.GET("/config/floors", middleware.AuthRequired(), configH.GetFloors)
		api.GET("/config/equipment-types", middleware.AuthRequired(), configH.GetEquipmentTypes)

		// 用户
		userH := users.NewHandler(repo, cache)
		api.GET("/users/search", middleware.AuthRequired(), userH.Search)
	}

	// 企微 API Mock
	wecomGroup := router.Group("/cgi-bin")
	{
		wcH := wecom.NewHandler(repo, cache)
		wecomGroup.GET("/gettoken", wcH.GetToken)
		wecomGroup.GET("/user/getuserinfo", wcH.GetUserInfo)
		wecomGroup.GET("/user/get", wcH.GetUser)
		wecomGroup.GET("/department/list", wcH.DepartmentList)
		wecomGroup.GET("/user/simplelist", wcH.SimpleList)
		wecomGroup.POST("/message/send", wcH.SendMessage)
		wecomGroup.POST("/message/send_template_card", wcH.SendTemplateCard)
		wecomGroup.POST("/calendar/calendar/add", wcH.CalendarAdd)
		wecomGroup.POST("/calendar/calendar/update", wcH.CalendarUpdate)
		wecomGroup.POST("/calendar/calendar/delete", wcH.CalendarDelete)
		wecomGroup.GET("/get_jsapi_ticket", wcH.GetJsapiTicket)
		wecomGroup.GET("/ticket/get", wcH.GetAppTicket)
	}

	// 启动服务
	srv := &http.Server{
		Addr:    fmt.Sprintf(":%s", cfg.ServerPort),
		Handler: router,
	}

	go func() {
		log.Printf("🚀 会议室预约系统后端启动于 :%s", cfg.ServerPort)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("服务启动失败: %v", err)
		}
	}()

	// 优雅关闭
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("正在关闭服务...")
	ctxShutdown, cancelShutdown := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancelShutdown()

	if err := srv.Shutdown(ctxShutdown); err != nil {
		log.Fatalf("服务关闭失败: %v", err)
	}
	log.Println("服务已关闭")
}

func seedData(repo *repository.DB) {
	var count int64
	repo.Model(&model.User{}).Count(&count)
	if count > 0 {
		return
	}

	log.Println("🌱 初始化种子数据...")

	now := time.Now()

	// 用户
	users := []model.User{
		{ID: "u-001", WecomUserID: "muzirili", Name: "木子日立", Department: "技术部", Role: "super_admin", Status: "active", CreatedAt: now, UpdatedAt: now},
		{ID: "u-002", WecomUserID: "zhiniu", Name: "执拗", Department: "产品部", Role: "admin", Status: "active", CreatedAt: now, UpdatedAt: now},
		{ID: "u-003", WecomUserID: "zhangsan", Name: "张三", Department: "技术部", Role: "employee", Status: "active", CreatedAt: now, UpdatedAt: now},
		{ID: "u-004", WecomUserID: "lisi", Name: "李四", Department: "产品部", Role: "employee", Status: "active", CreatedAt: now, UpdatedAt: now},
		{ID: "u-005", WecomUserID: "wangwu", Name: "王五", Department: "市场部", Role: "employee", Status: "active", CreatedAt: now, UpdatedAt: now},
		{ID: "u-006", WecomUserID: "zhaoliu", Name: "赵六", Department: "设计部", Role: "employee", Status: "active", CreatedAt: now, UpdatedAt: now},
		{ID: "u-007", WecomUserID: "sunqi", Name: "孙七", Department: "技术部", Role: "employee", Status: "active", CreatedAt: now, UpdatedAt: now},
		{ID: "u-008", WecomUserID: "zhouba", Name: "周八", Department: "行政部", Role: "admin", Status: "active", CreatedAt: now, UpdatedAt: now},
		{ID: "u-009", WecomUserID: "wujiu", Name: "吴九", Department: "市场部", Role: "employee", Status: "active", CreatedAt: now, UpdatedAt: now},
		{ID: "u-010", WecomUserID: "zhengshi", Name: "郑十", Department: "财务部", Role: "employee", Status: "active", CreatedAt: now, UpdatedAt: now},
		{ID: "u-011", WecomUserID: "it_ops", Name: "IT运维", Department: "IT部", Role: "it_admin", Status: "active", CreatedAt: now, UpdatedAt: now},
		{ID: "u-012", WecomUserID: "chenyi", Name: "陈一", Department: "技术部", Role: "employee", Status: "active", CreatedAt: now, UpdatedAt: now},
		{ID: "u-013", WecomUserID: "liner", Name: "林二", Department: "产品部", Role: "employee", Status: "active", CreatedAt: now, UpdatedAt: now},
		{ID: "u-014", WecomUserID: "huangsan", Name: "黄三", Department: "设计部", Role: "employee", Status: "active", CreatedAt: now, UpdatedAt: now},
		{ID: "u-015", WecomUserID: "liusi", Name: "刘四", Department: "行政部", Role: "employee", Status: "active", CreatedAt: now, UpdatedAt: now},
	}
	for _, u := range users {
		repo.Create(&u)
	}

	// 会议室
	rooms := []model.MeetingRoom{
		{ID: "room-001", Name: "3F-长江", Floor: "3F", Building: "A栋", Capacity: 6, RoomType: "small", Status: "active", LocationDesc: "3楼东侧走廊尽头", CreatedAt: now, UpdatedAt: now},
		{ID: "room-002", Name: "3F-黄河", Floor: "3F", Building: "A栋", Capacity: 8, RoomType: "medium", Status: "active", LocationDesc: "3楼西侧茶水间旁", CreatedAt: now, UpdatedAt: now},
		{ID: "room-003", Name: "3F-珠江", Floor: "3F", Building: "A栋", Capacity: 4, RoomType: "small", Status: "active", LocationDesc: "3楼南侧电梯口", CreatedAt: now, UpdatedAt: now},
		{ID: "room-004", Name: "5F-泰山", Floor: "5F", Building: "A栋", Capacity: 20, RoomType: "large", Status: "active", LocationDesc: "5楼中心区域", CreatedAt: now, UpdatedAt: now},
		{ID: "room-005", Name: "5F-华山", Floor: "5F", Building: "A栋", Capacity: 12, RoomType: "medium", Status: "active", LocationDesc: "5楼北侧", CreatedAt: now, UpdatedAt: now},
		{ID: "room-006", Name: "5F-衡山", Floor: "5F", Building: "A栋", Capacity: 6, RoomType: "small", Status: "maintenance", LocationDesc: "5楼东侧", CreatedAt: now, UpdatedAt: now},
		{ID: "room-007", Name: "8F-报告厅A", Floor: "8F", Building: "B栋", Capacity: 50, RoomType: "large", Status: "active", LocationDesc: "8楼整层", CreatedAt: now, UpdatedAt: now},
		{ID: "room-008", Name: "8F-报告厅B", Floor: "8F", Building: "B栋", Capacity: 30, RoomType: "large", Status: "active", LocationDesc: "8楼西翼", CreatedAt: now, UpdatedAt: now},
		{ID: "room-009", Name: "10F-云端", Floor: "10F", Building: "A栋", Capacity: 10, RoomType: "medium", Status: "active", LocationDesc: "10楼观景台旁", CreatedAt: now, UpdatedAt: now},
		{ID: "room-010", Name: "10F-星空", Floor: "10F", Building: "A栋", Capacity: 8, RoomType: "medium", Status: "active", LocationDesc: "10楼南侧", CreatedAt: now, UpdatedAt: now},
	}
	for _, r := range rooms {
		repo.Create(&r)
	}

	// 设备
	equipments := []model.Equipment{
		{ID: "eq-001", RoomID: "room-001", Name: "白板", Type: "whiteboard", Status: "available", CreatedAt: now, UpdatedAt: now},
		{ID: "eq-002", RoomID: "room-001", Name: "扩展坞", Type: "dock", Status: "available", CreatedAt: now, UpdatedAt: now},
		{ID: "eq-003", RoomID: "room-002", Name: "投影仪", Type: "projector", Status: "available", CreatedAt: now, UpdatedAt: now},
		{ID: "eq-004", RoomID: "room-002", Name: "白板", Type: "whiteboard", Status: "available", CreatedAt: now, UpdatedAt: now},
		{ID: "eq-005", RoomID: "room-002", Name: "会议电话", Type: "phone", Status: "faulty", CreatedAt: now, UpdatedAt: now},
		{ID: "eq-006", RoomID: "room-003", Name: "电视屏幕", Type: "tv", Status: "available", CreatedAt: now, UpdatedAt: now},
		{ID: "eq-007", RoomID: "room-003", Name: "扩展坞", Type: "dock", Status: "available", CreatedAt: now, UpdatedAt: now},
		{ID: "eq-008", RoomID: "room-004", Name: "投影仪", Type: "projector", Status: "available", CreatedAt: now, UpdatedAt: now},
		{ID: "eq-009", RoomID: "room-004", Name: "视频会议终端", Type: "vc_terminal", Status: "available", CreatedAt: now, UpdatedAt: now},
		{ID: "eq-010", RoomID: "room-004", Name: "麦克风", Type: "mic", Status: "available", CreatedAt: now, UpdatedAt: now},
		{ID: "eq-011", RoomID: "room-004", Name: "音响", Type: "speaker", Status: "available", CreatedAt: now, UpdatedAt: now},
		{ID: "eq-012", RoomID: "room-004", Name: "白板", Type: "whiteboard", Status: "available", CreatedAt: now, UpdatedAt: now},
	}
	for _, e := range equipments {
		repo.Create(&e)
	}

	// 预约规则
	rules := model.BookingRules{
		MaxAdvanceDays:        30,
		LatestBookingMinutes:  15,
		MinDurationMinutes:    15,
		MaxDurationMinutes:    240,
		MaxDailyBookings:      5,
		SmallRoomMinAttendees: 1,
		MediumRoomMinAttendees: 3,
		LargeRoomMinAttendees: 10,
		LargeRoomThreshold:    20,
		ApprovalTimeoutHours:  24,
	}
	repo.Create(&rules)

	log.Println("✅ 种子数据初始化完成")
}
