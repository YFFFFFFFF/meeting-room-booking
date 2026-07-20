package repository

import (
	"gorm.io/gorm"
	"github.com/YFFFFFFFF/meeting-room-booking/backend/internal/model"
)

type DB struct {
	*gorm.DB
}

func NewDB(db *gorm.DB) *DB {
	return &DB{db}
}

func (d *DB) AutoMigrate() error {
	return d.DB.AutoMigrate(
		&model.User{},
		&model.MeetingRoom{},
		&model.Booking{},
		&model.Attendee{},
		&model.Equipment{},
		&model.RepairTicket{},
		&model.Approval{},
		&model.BookingRules{},
	)
}
