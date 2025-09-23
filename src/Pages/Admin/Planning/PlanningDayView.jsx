import React from "react";

export default function PlanningDayView({ date, events, onEventClick }) {
  const formatTime = (date) => {
    return new Date(date).toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('fr-FR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <div className="planning-day-view">
      <h3>{formatDate(date)}</h3>

      <div className="day-events">
        {events.length === 0 ? (
          <p className="no-events">Aucun événement prévu pour cette journée</p>
        ) : (
          events.map(event => (
            <div
              key={event.id}
              className="event-item"
              onClick={() => onEventClick(event)}
            >
              <div className="event-time">
                {formatTime(event.start)} - {formatTime(event.end)}
              </div>
              <div className="event-title">{event.title}</div>
              <div className="event-description">{event.description}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
