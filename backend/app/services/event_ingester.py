import json
import random
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from app.models import RevenueEvent
from app.services import audit_logger, diagnosis_engine, recovery_policy, verifier, actor


@dataclass
class NormalizedEventData:
    event_type: str
    amount: int
    currency: str
    entity_id: Optional[str]
    order_id: Optional[str]
    email: Optional[str]
    contact: Optional[str]
    error_source: Optional[str]
    error_step: Optional[str]
    error_reason: Optional[str]
    payment_method: Optional[str]
    error_code: Optional[str] = None
    error_description: Optional[str] = None


class BaseWebhookEventNormalizer(ABC):
    """
    Abstract Base Class for polymorphic webhook payload normalizers.
    Extracts relevant payment, error codes, and customer metadata from different Razorpay webhook shapes.
    """

    @abstractmethod
    def can_handle(self, event_name: str) -> bool:
        pass

    @abstractmethod
    def normalize(self, event_name: str, payload: dict) -> NormalizedEventData:
        pass


class PaymentFailureEventNormalizer(BaseWebhookEventNormalizer):
    """Normalizes payment.failed and related transaction webhook payloads."""

    def can_handle(self, event_name: str) -> bool:
        return event_name in ('payment.failed', 'order.payment_failed', 'payment_failed')

    def normalize(self, event_name: str, payload: dict) -> NormalizedEventData:
        entity = payload.get('payload', {}).get('payment', {}).get('entity', {})
        if not entity and 'entity' in payload:
            entity = payload.get('entity', {})
        if not entity:
            entity = payload

        error_code = entity.get('error_code')
        error_desc = entity.get('error_description')
        error_reason = entity.get('error_reason') or error_desc or error_code

        return NormalizedEventData(
            event_type='payment_failed',
            amount=entity.get('amount', 0),
            currency=entity.get('currency', 'INR'),
            entity_id=entity.get('id'),
            order_id=entity.get('order_id'),
            email=entity.get('email') or entity.get('customer_details', {}).get('email'),
            contact=entity.get('contact') or entity.get('customer_details', {}).get('contact'),
            error_source=entity.get('error_source', 'gateway'),
            error_step=entity.get('error_step', 'payment_authorization'),
            error_reason=error_reason,
            payment_method=entity.get('method', 'card'),
            error_code=error_code,
            error_description=error_desc
        )


class InvoiceExpiredEventNormalizer(BaseWebhookEventNormalizer):
    """Normalizes invoice.expired and overdue invoice webhook payloads."""

    def can_handle(self, event_name: str) -> bool:
        return event_name in ('invoice.expired', 'invoice.cancelled', 'invoice_expired')

    def normalize(self, event_name: str, payload: dict) -> NormalizedEventData:
        entity = payload.get('payload', {}).get('invoice', {}).get('entity', {})
        if not entity and 'entity' in payload:
            entity = payload.get('entity', {})
        if not entity:
            entity = payload

        return NormalizedEventData(
            event_type='invoice_expired',
            amount=entity.get('amount', 0) or entity.get('amount_due', 0),
            currency=entity.get('currency', 'INR'),
            entity_id=entity.get('id'),
            order_id=entity.get('order_id'),
            email=entity.get('customer_details', {}).get('email') or entity.get('customer_email'),
            contact=entity.get('customer_details', {}).get('contact') or entity.get('customer_contact'),
            error_source='invoice_expiry',
            error_step='collection',
            error_reason='due_date_elapsed',
            payment_method='invoice'
        )


class SubscriptionHaltedEventNormalizer(BaseWebhookEventNormalizer):
    """Normalizes subscription.halted and subscription.charged.failed payloads."""

    def can_handle(self, event_name: str) -> bool:
        return event_name in ('subscription.halted', 'subscription.pending', 'subscription.charged.failed', 'subscription_halted')

    def normalize(self, event_name: str, payload: dict) -> NormalizedEventData:
        entity = payload.get('payload', {}).get('subscription', {}).get('entity', {})
        if not entity and 'entity' in payload:
            entity = payload.get('entity', {})
        if not entity:
            entity = payload

        return NormalizedEventData(
            event_type='subscription_halted',
            amount=entity.get('charge_amount', 0) or entity.get('amount', 0) or 150000,
            currency=entity.get('currency', 'INR'),
            entity_id=entity.get('id'),
            order_id=None,
            email=entity.get('customer_details', {}).get('email') or entity.get('customer_email'),
            contact=entity.get('customer_details', {}).get('contact'),
            error_source='mandate_failure',
            error_step='recurring_charge',
            error_reason='mandate_charge_halted',
            payment_method='recurring_mandate'
        )


class CheckoutAbandonmentEventNormalizer(BaseWebhookEventNormalizer):
    """Normalizes checkout abandonment and unpaid order events."""

    def can_handle(self, event_name: str) -> bool:
        return event_name in ('checkout_abandoned', 'order.abandoned')

    def normalize(self, event_name: str, payload: dict) -> NormalizedEventData:
        entity = payload.get('payload', {}).get('order', {}).get('entity', {})
        if not entity and 'entity' in payload:
            entity = payload.get('entity', {})
        if not entity:
            entity = payload

        notes = entity.get('notes', {})
        email = notes.get('customer_email') if isinstance(notes, dict) else None

        return NormalizedEventData(
            event_type='checkout_abandoned',
            amount=entity.get('amount', 0),
            currency=entity.get('currency', 'INR'),
            entity_id=entity.get('id'),
            order_id=entity.get('id'),
            email=email,
            contact=None,
            error_source='customer',
            error_step='checkout_interaction',
            error_reason='cart_abandoned',
            payment_method='checkout'
        )


class GenericEventNormalizer(BaseWebhookEventNormalizer):
    """Fallback normalizer scanning for generic nested payload entity."""

    def can_handle(self, event_name: str) -> bool:
        return True

    def normalize(self, event_name: str, payload: dict) -> NormalizedEventData:
        entity = {}
        if 'payload' in payload and isinstance(payload['payload'], dict):
            for key in payload['payload']:
                if isinstance(payload['payload'][key], dict) and 'entity' in payload['payload'][key]:
                    entity = payload['payload'][key]['entity']
                    break
        if not entity and isinstance(payload, dict):
            entity = payload

        return NormalizedEventData(
            event_type='unknown',
            amount=entity.get('amount', 0),
            currency=entity.get('currency', 'INR'),
            entity_id=entity.get('id'),
            order_id=entity.get('order_id'),
            email=entity.get('email'),
            contact=entity.get('contact'),
            error_source=entity.get('error_source'),
            error_step=entity.get('error_step'),
            error_reason=entity.get('error_reason'),
            payment_method=entity.get('method')
        )


class EventIngestionPipeline:
    """
    Polymorphic Event Ingestion Pipeline.
    Dispatches normalization, enforces strict idempotency by razorpay_object_id,
    persists normalized events, and runs diagnosis → bandit → verifier gate → actor lifecycle.
    """

    def __init__(self):
        self._normalizers: List[BaseWebhookEventNormalizer] = [
            PaymentFailureEventNormalizer(),
            InvoiceExpiredEventNormalizer(),
            SubscriptionHaltedEventNormalizer(),
            CheckoutAbandonmentEventNormalizer(),
            GenericEventNormalizer()
        ]

    def normalize_payload(self, event_name: str, payload: dict) -> NormalizedEventData:
        normalizer = next((n for n in self._normalizers if n.can_handle(event_name)), GenericEventNormalizer())
        return normalizer.normalize(event_name, payload)

    async def ingest_webhook_event(self, db: AsyncSession, event_name: str, payload: dict) -> Optional[RevenueEvent]:
        norm = self.normalize_payload(event_name, payload)
        object_id = norm.entity_id or norm.order_id

        # 1. Strict Idempotency Check: check razorpay_object_id, entity_id, or order_id
        if object_id:
            stmt = select(RevenueEvent).where(
                or_(
                    RevenueEvent.razorpay_object_id == object_id,
                    RevenueEvent.razorpay_entity_id == object_id,
                    RevenueEvent.razorpay_order_id == object_id
                )
            )
            existing = (await db.execute(stmt)).scalars().first()
            if existing:
                return existing

        # 2. Insert new RevenueEvent
        event = RevenueEvent(
            event_type=norm.event_type,
            razorpay_object_id=object_id,
            razorpay_entity_id=norm.entity_id,
            razorpay_order_id=norm.order_id,
            amount_at_risk=norm.amount or 100000,
            currency=norm.currency,
            error_source=norm.error_source,
            error_step=norm.error_step,
            error_reason=norm.error_reason,
            payment_method=norm.payment_method,
            customer_email=norm.email,
            customer_contact=norm.contact,
            raw_payload=json.dumps(payload),
            status='new'
        )
        db.add(event)
        await db.commit()
        await db.refresh(event)

        await audit_logger.log(db, event.id, 'ingested', {
            'source': 'webhook',
            'event_name': event_name,
            'razorpay_object_id': object_id,
            'razorpay_entity_id': norm.entity_id,
            'razorpay_order_id': norm.order_id,
            'verbatim_error_reason': norm.error_reason
        })

        diagnosis = await diagnosis_engine.diagnose(db, event)
        action = await recovery_policy.select_action(db, event, diagnosis)
        
        # Verifier Human Review Gate evaluation
        action = await verifier.evaluate_human_review_gate(db, action, event, diagnosis)
        
        # Only execute immediately if auto-approved (not requiring human review)
        if action.review_status != 'pending':
            await actor.execute_action(db, action, event)

        return event

    async def ingest_simulated_event(
        self,
        db: AsyncSession,
        event_type: str,
        amount: int,
        customer_email: str = None,
        customer_contact: str = None,
        error_source: str = None,
        error_reason: str = None,
        razorpay_entity_id: str = None,
        razorpay_order_id: str = None
    ) -> RevenueEvent:
        entity_id = razorpay_entity_id or f"rzp_test_sim_{random.randint(10000, 99999)}"
        object_id = razorpay_entity_id or razorpay_order_id or entity_id

        # Strict idempotency check
        if object_id:
            stmt = select(RevenueEvent).where(
                or_(
                    RevenueEvent.razorpay_object_id == object_id,
                    RevenueEvent.razorpay_entity_id == object_id,
                    RevenueEvent.razorpay_order_id == object_id
                )
            )
            existing = (await db.execute(stmt)).scalars().first()
            if existing:
                return existing

        event = RevenueEvent(
            event_type=event_type,
            razorpay_object_id=object_id,
            razorpay_entity_id=entity_id,
            razorpay_order_id=razorpay_order_id,
            amount_at_risk=amount,
            currency='INR',
            error_source=error_source,
            error_reason=error_reason,
            customer_email=customer_email,
            customer_contact=customer_contact,
            raw_payload=json.dumps({"source": "scenario_driver", "entity_id": entity_id}),
            status='new'
        )
        db.add(event)
        await db.commit()
        await db.refresh(event)

        await audit_logger.log(db, event.id, 'ingested', {
            'source': 'scenario_driver',
            'event_type': event_type,
            'amount': amount,
            'razorpay_object_id': object_id,
            'razorpay_entity_id': entity_id
        })

        diagnosis = await diagnosis_engine.diagnose(db, event)
        action = await recovery_policy.select_action(db, event, diagnosis)
        
        # Verifier Human Review Gate evaluation
        action = await verifier.evaluate_human_review_gate(db, action, event, diagnosis)
        
        # Only execute immediately if auto-approved (not requiring human review)
        if action.review_status != 'pending':
            await actor.execute_action(db, action, event)

        return event


# Singleton pipeline
ingestion_pipeline = EventIngestionPipeline()


async def ingest_webhook_event(db: AsyncSession, event_name: str, payload: dict) -> Optional[RevenueEvent]:
    return await ingestion_pipeline.ingest_webhook_event(db, event_name, payload)


async def ingest_simulated_event(
    db: AsyncSession,
    event_type: str,
    amount: int,
    customer_email: str = None,
    customer_contact: str = None,
    error_source: str = None,
    error_reason: str = None,
    razorpay_entity_id: str = None,
    razorpay_order_id: str = None
) -> RevenueEvent:
    return await ingestion_pipeline.ingest_simulated_event(
        db, event_type, amount, customer_email, customer_contact, error_source, error_reason, razorpay_entity_id, razorpay_order_id
    )
