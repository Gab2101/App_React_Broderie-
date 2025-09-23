import React from "react";

export default function PlanningGrid({ events, onEventClick, onTimeSlotClick }) {
  const hours = Array.from({ length: 24 }, (_, i) => i);

  const getEventsForHour = (hour) => {
    return events.filter(event => {
      const eventHour = new Date(event.start).getHours();
      return eventHour === hour;
    });
  };

  return (
    <div className="planning-grid">
      <div className="grid-header">
        <div className="time-column">Heure</div>
        <div className="events-column">Événements</div>
      </div>

      {hours.map(hour => (
        <div key={hour} className="grid-row">
          <div className="time-column">
            {hour.toString().padStart(2, '0')}:00
          </div>
          <div
            className="events-column"
            onClick={() => onTimeSlotClick && onTimeSlotClick(hour)}
          >
            {getEventsForHour(hour).map(event => (
              <div
                key={event.id}
                className="event-item"
                onClick={(e) => {
                  e.stopPropagation();
                  onEventClick && onEventClick(event);
                }}
              >
                <div className="event-title">{event.title}</div>
                <div className="event-time">
                  {new Date(event.start).toLocaleTimeString('fr-FR', {
                    hour: '2-digit',
                    minute: '2-digit'
                  })} - {new Date(event.end).toLocaleTimeString('fr-FR', {
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
