import json
from datetime import datetime
from typing import List, Optional, Dict, Any, TypeVar, Generic
from pydantic import BaseModel, ConfigDict, computed_field, model_validator


class ActionOutcomeOut(BaseModel):
    id: int
    action_id: int
    event_id: int
    success: bool
    amount_recovered: int
    verification_method: str
    verified_at: datetime
    notes: Optional[str] = None

    @computed_field
    @property
    def amount_recovered_display(self) -> str:
        return f"\u20b9{self.amount_recovered / 100:,.2f}"

    model_config = ConfigDict(from_attributes=True)


class RecoveryActionOut(BaseModel):
    id: int
    event_id: int
    diagnosis_id: int
    action_type: str
    action_params_raw: Optional[str] = None
    result_details_raw: Optional[str] = None
    status: str
    requires_human_review: bool = False
    review_status: str = 'not_required'
    reviewed_by: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    review_reason: Optional[str] = None
    executed_at: Optional[datetime] = None
    created_at: datetime
    outcome: Optional[ActionOutcomeOut] = None

    @model_validator(mode="before")
    @classmethod
    def extract_json_fields(cls, data: Any) -> Any:
        if hasattr(data, "__dict__"):
            obj = data
            return {
                "id": obj.id,
                "event_id": obj.event_id,
                "diagnosis_id": obj.diagnosis_id,
                "action_type": obj.action_type,
                "action_params_raw": obj.action_params,
                "result_details_raw": obj.result_details,
                "status": obj.status,
                "requires_human_review": getattr(obj, "requires_human_review", False),
                "review_status": getattr(obj, "review_status", "not_required"),
                "reviewed_by": getattr(obj, "reviewed_by", None),
                "reviewed_at": getattr(obj, "reviewed_at", None),
                "review_reason": getattr(obj, "review_reason", None),
                "executed_at": obj.executed_at,
                "created_at": obj.created_at,
                "outcome": getattr(obj, "outcome", None),
            }
        return data

    @computed_field
    @property
    def action_params(self) -> Dict[str, Any]:
        if self.action_params_raw:
            try:
                return json.loads(self.action_params_raw)
            except (json.JSONDecodeError, TypeError):
                pass
        return {}

    @computed_field
    @property
    def result_details(self) -> Optional[Dict[str, Any]]:
        if self.result_details_raw:
            try:
                return json.loads(self.result_details_raw)
            except (json.JSONDecodeError, TypeError):
                pass
        return None

    model_config = ConfigDict(from_attributes=True)


class DiagnosisOut(BaseModel):
    id: int
    event_id: int
    root_cause: str
    severity: int
    confidence: float
    is_systemic: bool = False
    recommended_actions_raw: Optional[str] = None
    reasoning: str
    created_at: datetime

    @model_validator(mode="before")
    @classmethod
    def extract_json_fields(cls, data: Any) -> Any:
        if hasattr(data, "__dict__"):
            obj = data
            return {
                "id": obj.id,
                "event_id": obj.event_id,
                "root_cause": obj.root_cause,
                "severity": obj.severity,
                "confidence": obj.confidence,
                "is_systemic": getattr(obj, "is_systemic", False),
                "recommended_actions_raw": obj.recommended_actions,
                "reasoning": obj.reasoning,
                "created_at": obj.created_at,
            }
        return data

    @computed_field
    @property
    def recommended_actions(self) -> List[str]:
        if self.recommended_actions_raw:
            try:
                return json.loads(self.recommended_actions_raw)
            except (json.JSONDecodeError, TypeError):
                pass
        return []

    model_config = ConfigDict(from_attributes=True)


class AuditTrailOut(BaseModel):
    id: int
    event_id: int
    stage: str
    actor: str
    details_raw: Optional[str] = None
    created_at: datetime

    @model_validator(mode="before")
    @classmethod
    def extract_json_fields(cls, data: Any) -> Any:
        if hasattr(data, "__dict__"):
            obj = data
            return {
                "id": obj.id,
                "event_id": obj.event_id,
                "stage": obj.stage,
                "actor": obj.actor,
                "details_raw": obj.details,
                "created_at": obj.created_at,
            }
        return data

    @computed_field
    @property
    def details(self) -> Dict[str, Any]:
        if self.details_raw:
            try:
                return json.loads(self.details_raw)
            except (json.JSONDecodeError, TypeError):
                pass
        return {}

    model_config = ConfigDict(from_attributes=True)


class EventOut(BaseModel):
    id: int
    event_type: str
    razorpay_entity_id: Optional[str] = None
    amount_at_risk: int
    currency: str
    error_source: Optional[str] = None
    error_step: Optional[str] = None
    error_reason: Optional[str] = None
    payment_method: Optional[str] = None
    customer_email: Optional[str] = None
    customer_contact: Optional[str] = None
    status: str
    created_at: datetime

    @computed_field
    @property
    def amount_display(self) -> str:
        return f"\u20b9{self.amount_at_risk / 100:,.2f}"

    model_config = ConfigDict(from_attributes=True)


class EventDetail(EventOut):
    diagnoses: List[DiagnosisOut] = []
    recovery_actions: List[RecoveryActionOut] = []
    audit_entries: List[AuditTrailOut] = []


class ReviewQueueItem(BaseModel):
    id: int # recovery action ID
    event_id: int
    entity_id: Optional[str] = None
    loss_type: str
    amount_at_risk: int
    amount_display: str
    diagnosis_category: str
    severity: int
    confidence: float
    is_systemic: bool
    proposed_action: str
    actor_justification: str
    customer_email: Optional[str] = None
    customer_contact: Optional[str] = None
    review_status: str
    requires_human_review: bool
    review_trigger_reasons: List[str] = []
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ReviewDecisionRequest(BaseModel):
    reviewed_by: Optional[str] = "Risk Ops Specialist"
    review_reason: Optional[str] = None


class ReviewRejectRequest(BaseModel):
    reviewed_by: Optional[str] = "Risk Ops Specialist"
    review_reason: str


class ReviewQueueCount(BaseModel):
    count: int


class DashboardSummary(BaseModel):
    total_at_risk: int
    total_recovered: int
    recovery_rate: float
    active_events: int
    pending_reviews: int = 0
    events_by_type: Dict[str, int]
    events_by_status: Dict[str, int]

    @computed_field
    @property
    def total_at_risk_display(self) -> str:
        return f"\u20b9{self.total_at_risk / 100:,.2f}"

    @computed_field
    @property
    def total_recovered_display(self) -> str:
        return f"\u20b9{self.total_recovered / 100:,.2f}"


class AnalyticsData(BaseModel):
    date: str
    at_risk: int
    recovered: int


class PolicyStatsOut(BaseModel):
    event_type: str
    action_type: str
    alpha: float
    beta_param: float
    total_attempts: int
    total_successes: int

    @computed_field
    @property
    def success_rate(self) -> float:
        return self.total_successes / self.total_attempts if self.total_attempts > 0 else 0.0

    model_config = ConfigDict(from_attributes=True)


class SimulateRequest(BaseModel):
    event_type: Optional[str] = None
    amount: Optional[int] = None
    customer_email: Optional[str] = None
    customer_contact: Optional[str] = None
    is_systemic: Optional[bool] = False


class BulkSimulateRequest(BaseModel):
    count: int = 10


T = TypeVar("T")


class PaginatedResponse(BaseModel, Generic[T]):
    items: List[T]
    total: int
    page: int
    page_size: int
