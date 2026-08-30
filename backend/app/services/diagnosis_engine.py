import json
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from app.models import RevenueEvent, Diagnosis
from app.services import audit_logger


@dataclass
class DiagnosisResult:
    root_cause: str
    severity: int
    confidence: float
    recommended_actions: List[str]
    reasoning: str
    is_systemic: bool = False


class BaseDiagnosisStrategy(ABC):
    """
    Abstract Base Class for polymorphic event diagnosis strategies.
    Each event type or error category subclasses this to provide specialized root cause analysis.
    """

    @abstractmethod
    def can_handle(self, event: RevenueEvent) -> bool:
        """Determines if this strategy can diagnose the given event."""
        pass

    @abstractmethod
    def evaluate(self, event: RevenueEvent) -> DiagnosisResult:
        """Performs polymorphic diagnostic evaluation."""
        pass


class PaymentFailureDiagnosisStrategy(BaseDiagnosisStrategy):
    """Diagnoses payment failure events across customer and gateway error codes."""

    def can_handle(self, event: RevenueEvent) -> bool:
        return event.event_type == 'payment_failed'

    def evaluate(self, event: RevenueEvent) -> DiagnosisResult:
        error_src = (event.error_source or "").lower()
        error_reason = (event.error_reason or "").lower()

        if error_src == 'customer':
            if 'cancelled' in error_reason:
                return DiagnosisResult(
                    root_cause="customer_cancelled",
                    severity=2,
                    confidence=0.92,
                    recommended_actions=["send_retry_link", "offer_alternate_method"],
                    reasoning="Customer intentionally cancelled payment modal during checkout.",
                    is_systemic=False
                )
            elif 'insufficient_funds' in error_reason:
                return DiagnosisResult(
                    root_cause="insufficient_funds",
                    severity=3,
                    confidence=0.96,
                    recommended_actions=["send_retry_link", "apply_discount"],
                    reasoning="Payment declined by bank due to insufficient funds in customer account.",
                    is_systemic=False
                )
            elif 'invalid_otp' in error_reason or 'otp' in error_reason:
                return DiagnosisResult(
                    root_cause="auth_failure",
                    severity=2,
                    confidence=0.88,
                    recommended_actions=["send_retry_link", "offer_alternate_method"],
                    reasoning="3D Secure / OTP authentication verification failed.",
                    is_systemic=False
                )
            elif 'timeout' in error_reason or 'session' in error_reason:
                return DiagnosisResult(
                    root_cause="session_timeout",
                    severity=2,
                    confidence=0.84,
                    recommended_actions=["send_retry_link"],
                    reasoning="Session timed out during customer banking authorization.",
                    is_systemic=False
                )
            else:
                return DiagnosisResult(
                    root_cause="customer_declined",
                    severity=2,
                    confidence=0.75,
                    recommended_actions=["send_retry_link", "offer_alternate_method"],
                    reasoning=f"Customer side error: {event.error_reason or 'General decline'}",
                    is_systemic=False
                )
        elif error_src == 'gateway':
            return DiagnosisResult(
                root_cause="gateway_down",
                severity=4,
                confidence=0.85,
                recommended_actions=["auto_retry_payment", "offer_alternate_method"],
                reasoning="Issuing bank or network payment gateway reported technical failure/downtime.",
                is_systemic=True
            )
        else:
            return DiagnosisResult(
                root_cause="unclassified_payment_failure",
                severity=3,
                confidence=0.70,
                recommended_actions=["send_retry_link", "offer_alternate_method"],
                reasoning=f"Unclassified payment failure with reason: {event.error_reason or 'Unknown'}",
                is_systemic=False
            )


class CheckoutAbandonmentDiagnosisStrategy(BaseDiagnosisStrategy):
    """Diagnoses checkout dropoffs and cart abandonments."""

    def can_handle(self, event: RevenueEvent) -> bool:
        return event.event_type == 'checkout_abandoned'

    def evaluate(self, event: RevenueEvent) -> DiagnosisResult:
        return DiagnosisResult(
            root_cause="cart_abandoned",
            severity=3,
            confidence=0.87,
            recommended_actions=["send_reminder_email", "apply_discount"],
            reasoning="Checkout initialized with unpaid balance; user dropped before payment capture.",
            is_systemic=False
        )


class InvoiceExpiredDiagnosisStrategy(BaseDiagnosisStrategy):
    """Diagnoses overdue corporate or consumer invoices."""

    def can_handle(self, event: RevenueEvent) -> bool:
        return event.event_type == 'invoice_expired'

    def evaluate(self, event: RevenueEvent) -> DiagnosisResult:
        return DiagnosisResult(
            root_cause="invoice_overdue",
            severity=4,
            confidence=0.95,
            recommended_actions=["send_invoice_reminder", "escalate_to_support"],
            reasoning="Invoice validity window elapsed without settlement; categorized as overdue receivables.",
            is_systemic=False
        )


class SubscriptionHaltedDiagnosisStrategy(BaseDiagnosisStrategy):
    """Diagnoses recurring mandate failures and subscription churn risks."""

    def can_handle(self, event: RevenueEvent) -> bool:
        return event.event_type in ('subscription_halted', 'subscription_pending')

    def evaluate(self, event: RevenueEvent) -> DiagnosisResult:
        return DiagnosisResult(
            root_cause="subscription_churn",
            severity=5,
            confidence=0.91,
            recommended_actions=["send_retry_link", "escalate_to_support", "apply_discount"],
            reasoning="Recurring mandate debit halted after retry exhaustion; high churn hazard.",
            is_systemic=True
        )


class DefaultDiagnosisStrategy(BaseDiagnosisStrategy):
    """Fallback diagnostic strategy for unrecognized revenue events."""

    def can_handle(self, event: RevenueEvent) -> bool:
        return True

    def evaluate(self, event: RevenueEvent) -> DiagnosisResult:
        return DiagnosisResult(
            root_cause="unclassified_risk",
            severity=2,
            confidence=0.50,
            recommended_actions=["send_retry_link", "offer_alternate_method"],
            reasoning="Default classification due to unrecognized event signature.",
            is_systemic=False
        )


class DiagnosisEngine:
    """
    Polymorphic Diagnosis Engine that delegates diagnosis to the appropriate strategy.
    """

    def __init__(self):
        self._strategies: List[BaseDiagnosisStrategy] = [
            PaymentFailureDiagnosisStrategy(),
            CheckoutAbandonmentDiagnosisStrategy(),
            InvoiceExpiredDiagnosisStrategy(),
            SubscriptionHaltedDiagnosisStrategy(),
            DefaultDiagnosisStrategy()  # Fallback
        ]

    def register_strategy(self, strategy: BaseDiagnosisStrategy, priority: int = 0):
        """Allows dynamic registration of new polymorphic diagnosis strategies."""
        self._strategies.insert(priority, strategy)

    async def diagnose(self, db: AsyncSession, event: RevenueEvent) -> Diagnosis:
        """Finds the matching polymorphic strategy and creates a Diagnosis record."""
        # Find matching strategy polymorphically
        matched_strategy = next((s for s in self._strategies if s.can_handle(event)), DefaultDiagnosisStrategy())
        result = matched_strategy.evaluate(event)

        diagnosis = Diagnosis(
            event_id=event.id,
            root_cause=result.root_cause,
            severity=result.severity,
            confidence=result.confidence,
            is_systemic=result.is_systemic,
            recommended_actions=json.dumps(result.recommended_actions),
            reasoning=result.reasoning
        )
        db.add(diagnosis)
        event.status = 'diagnosed'
        await db.commit()
        await db.refresh(diagnosis)

        await audit_logger.log(db, event.id, 'diagnosed', {
            'diagnosis_id': diagnosis.id,
            'root_cause': diagnosis.root_cause,
            'strategy_applied': matched_strategy.__class__.__name__,
            'confidence': diagnosis.confidence,
            'is_systemic': diagnosis.is_systemic
        })

        return diagnosis


# Singleton instance
diagnosis_engine_instance = DiagnosisEngine()


async def diagnose(db: AsyncSession, event: RevenueEvent) -> Diagnosis:
    """Main diagnosis entrypoint preserving existing interface."""
    return await diagnosis_engine_instance.diagnose(db, event)
