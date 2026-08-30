from datetime import datetime, timezone
from typing import List, Optional
from sqlalchemy import Integer, String, Text, DateTime, Float, Boolean, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship, Mapped, mapped_column
from app.database import Base

def utcnow():
    return datetime.now(timezone.utc)

class RevenueEvent(Base):
    __tablename__ = 'revenue_events'

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    event_type: Mapped[str] = mapped_column(String, index=True)
    razorpay_object_id: Mapped[Optional[str]] = mapped_column(String, index=True, nullable=True, unique=True)
    razorpay_entity_id: Mapped[Optional[str]] = mapped_column(String, nullable=True, index=True)
    razorpay_order_id: Mapped[Optional[str]] = mapped_column(String, nullable=True, index=True)
    amount_at_risk: Mapped[int] = mapped_column(Integer)
    currency: Mapped[str] = mapped_column(String, default='INR')
    error_source: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    error_step: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    error_reason: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    payment_method: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    customer_email: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    customer_contact: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    raw_payload: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String, default='new')
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime, onupdate=utcnow, nullable=True)

    diagnoses: Mapped[List["Diagnosis"]] = relationship(back_populates="event", cascade="all, delete-orphan")
    recovery_actions: Mapped[List["RecoveryAction"]] = relationship(back_populates="event", cascade="all, delete-orphan")
    audit_entries: Mapped[List["AuditTrail"]] = relationship(back_populates="event", cascade="all, delete-orphan")


class Diagnosis(Base):
    __tablename__ = 'diagnoses'

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    event_id: Mapped[int] = mapped_column(Integer, ForeignKey('revenue_events.id'))
    root_cause: Mapped[str] = mapped_column(String)
    severity: Mapped[int] = mapped_column(Integer)
    confidence: Mapped[float] = mapped_column(Float)
    is_systemic: Mapped[bool] = mapped_column(Boolean, default=False)
    recommended_actions: Mapped[str] = mapped_column(Text) # JSON list
    reasoning: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    event: Mapped["RevenueEvent"] = relationship(back_populates="diagnoses")
    recovery_actions: Mapped[List["RecoveryAction"]] = relationship(back_populates="diagnosis")


class RecoveryAction(Base):
    __tablename__ = 'recovery_actions'

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    event_id: Mapped[int] = mapped_column(Integer, ForeignKey('revenue_events.id'))
    diagnosis_id: Mapped[int] = mapped_column(Integer, ForeignKey('diagnoses.id'))
    action_type: Mapped[str] = mapped_column(String)
    action_params: Mapped[str] = mapped_column(Text) # JSON
    status: Mapped[str] = mapped_column(String) # pending, executed, rejected, verified_success, verified_failure
    
    # Human-in-the-loop review fields
    requires_human_review: Mapped[bool] = mapped_column(Boolean, default=False)
    review_status: Mapped[str] = mapped_column(String, default='not_required') # not_required, pending, approved, rejected
    reviewed_by: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    reviewed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    review_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    result_details: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    executed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    event: Mapped["RevenueEvent"] = relationship(back_populates="recovery_actions")
    diagnosis: Mapped["Diagnosis"] = relationship(back_populates="recovery_actions")
    outcome: Mapped[Optional["ActionOutcome"]] = relationship(back_populates="action", uselist=False)


class ActionOutcome(Base):
    __tablename__ = 'action_outcomes'

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    action_id: Mapped[int] = mapped_column(Integer, ForeignKey('recovery_actions.id'), unique=True)
    event_id: Mapped[int] = mapped_column(Integer, ForeignKey('revenue_events.id'))
    success: Mapped[bool] = mapped_column(Boolean)
    amount_recovered: Mapped[int] = mapped_column(Integer, default=0)
    verification_method: Mapped[str] = mapped_column(String)
    verified_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    action: Mapped["RecoveryAction"] = relationship(back_populates="outcome")
    event: Mapped["RevenueEvent"] = relationship()


class AuditTrail(Base):
    __tablename__ = 'audit_trails'

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    event_id: Mapped[int] = mapped_column(Integer, ForeignKey('revenue_events.id'))
    stage: Mapped[str] = mapped_column(String)
    actor: Mapped[str] = mapped_column(String, default='system')
    details: Mapped[str] = mapped_column(Text) # JSON
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    event: Mapped["RevenueEvent"] = relationship(back_populates="audit_entries")


class PolicyStats(Base):
    __tablename__ = 'policy_stats'

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    event_type: Mapped[str] = mapped_column(String)
    action_type: Mapped[str] = mapped_column(String)
    alpha: Mapped[float] = mapped_column(Float, default=1.0)
    beta_param: Mapped[float] = mapped_column(Float, default=1.0)
    total_attempts: Mapped[int] = mapped_column(Integer, default=0)
    total_successes: Mapped[int] = mapped_column(Integer, default=0)
    last_updated: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)

    __table_args__ = (UniqueConstraint('event_type', 'action_type', name='uq_event_action'),)


class WebhookLog(Base):
    __tablename__ = 'webhook_logs'

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    event_type: Mapped[str] = mapped_column(String)
    payload: Mapped[str] = mapped_column(Text)
    received_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    verified: Mapped[bool] = mapped_column(Boolean, default=False)


class PollingState(Base):
    __tablename__ = 'polling_states'

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    last_polled_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    new_events_found: Mapped[int] = mapped_column(Integer, default=0)
    skipped_duplicates: Mapped[int] = mapped_column(Integer, default=0)
    interval_seconds: Mapped[int] = mapped_column(Integer, default=60)
    last_summary: Mapped[Optional[str]] = mapped_column(Text, nullable=True) # JSON details
