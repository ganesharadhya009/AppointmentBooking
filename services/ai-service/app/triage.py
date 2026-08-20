from datetime import datetime, timezone

from app.schemas import EnquiryInfo, EnquiryTriageItem


def rank_enquiries(enquiries: list[EnquiryInfo]) -> list[EnquiryTriageItem]:
    """Pure function: score each Submitted enquiry by follow-up priority and
    return them sorted highest-priority first. See design spec §2 for the
    rule-based scoring rationale.
    """
    now = datetime.now(timezone.utc)
    items: list[EnquiryTriageItem] = []

    for enquiry in enquiries:
        days_waiting = max((now - enquiry.created_at).days, 0)
        score = float(min(days_waiting, 30))
        reasons: list[str] = [f"Waiting {days_waiting} day{'s' if days_waiting != 1 else ''}"]

        if enquiry.follow_up_date is not None:
            follow_up_days = (now - enquiry.follow_up_date).days
            if follow_up_days > 0:
                score += 50
                reasons.append(f"Follow-up overdue by {follow_up_days} day{'s' if follow_up_days != 1 else ''}")
            elif follow_up_days == 0:
                score += 20
                reasons.append("Follow-up due today")

        if enquiry.diagnosis_report_url:
            score += 10
            reasons.append("Diagnosis report attached")

        if enquiry.concerns:
            score += len(enquiry.concerns) * 2
            reasons.append(f"{len(enquiry.concerns)} concern{'s' if len(enquiry.concerns) != 1 else ''} noted")

        items.append(
            EnquiryTriageItem(
                enquiry_id=enquiry.id,
                parent_name=enquiry.parent_name,
                child_name=enquiry.child_name,
                priority_score=score,
                reasons=reasons,
                days_waiting=days_waiting,
                follow_up_date=enquiry.follow_up_date,
            )
        )

    items.sort(key=lambda item: item.priority_score, reverse=True)
    return items
