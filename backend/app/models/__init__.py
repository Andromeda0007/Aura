"""ORM models. Import all here so Alembic autogenerate sees them."""
from app.models.enums import (
    CommandIntent,
    CommandStatus,
    SessionStatus,
    UserRole,
)
from app.models.assignment import Assignment, AssignmentSubmission
from app.models.batch import Batch
from app.models.command import Command
from app.models.course import Course
from app.models.department import Department
from app.models.quiz import Quiz
from app.models.quiz_attempt import QuizAttempt
from app.models.semester import Semester
from app.models.semester_member import SemesterMember
from app.models.session import Session
from app.models.transcript import Transcript
from app.models.unit import Unit
from app.models.user import User
from app.models.whiteboard import WhiteboardLog

__all__ = [
    "User",
    "Batch",
    "Department",
    "Semester",
    "SemesterMember",
    "Unit",
    "Session",
    "Transcript",
    "WhiteboardLog",
    "Assignment",
    "AssignmentSubmission",
    "Command",
    "Course",
    "Quiz",
    "QuizAttempt",
    "UserRole",
    "SessionStatus",
    "CommandIntent",
    "CommandStatus",
]
