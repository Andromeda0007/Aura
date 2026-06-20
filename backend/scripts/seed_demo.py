"""Idempotent demo seed — recreate the college structure + course catalog.

Run after a DB reset to rebuild everything:
    cd backend && .venv/bin/python scripts/seed_demo.py

Safe to run repeatedly: it skips anything that already exists. Edit the data
tables below to add more batches / departments / subjects.
"""
from __future__ import annotations

import sys
from pathlib import Path

# allow running as a plain script (so `app` is importable)
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import select  # noqa: E402

from app.core.database import session_scope  # noqa: E402
from app.core.seed import seed_admin  # noqa: E402
from app.models.batch import Batch  # noqa: E402
from app.models.course import Course  # noqa: E402
from app.models.department import Department  # noqa: E402
from app.models.enums import UserRole  # noqa: E402
from app.models.semester import Semester  # noqa: E402
from app.models.unit import Unit  # noqa: E402
from app.models.user import User  # noqa: E402

# --- structure ---------------------------------------------------------------
BATCHES = [(2022, 2026), (2023, 2027), (2024, 2028), (2025, 2029)]

DEPARTMENTS = [
    ("Computer Science", "indigo"),
    ("Information Technology", "sky"),
    ("Electronics & Telecommunication", "amber"),
    ("Mechanical", "emerald"),
]
SEMESTERS_PER_DEPT = 8

# --- course catalog: (start_year, end_year, department, semester) -> [(name, cover)] ---
COURSES: dict[tuple[int, int, str, int], list[tuple[str, str]]] = {
    (2022, 2026, "Computer Science", 8): [
        ("High Performance Computing", "chip"),
        ("Deep Learning", "network"),
        ("Natural Language Processing", "code"),
        ("Image Processing", "world"),
        ("Advanced Digital Signal Processing", "math"),
        ("Pattern Recognition", "chemistry"),
        ("Soft Computing", "book"),
        ("Business Intelligence", "database"),
        ("Quantum Computing", "science"),
    ],
    (2023, 2027, "Computer Science", 6): [
        ("Data Science and Big Data Analytics", "database"),
        ("Web Technology", "code"),
        ("Artificial Intelligence", "science"),
        ("Information Security", "law"),
        ("Augmented and Virtual Reality", "world"),
        ("Cloud Computing", "network"),
        ("Software Modeling and Architectures", "chip"),
    ],
    (2024, 2028, "Computer Science", 4): [
        ("Database Management System", "database"),
        ("Discrete Mathematics", "math"),
        ("Computer Organization and Microprocessor", "chip"),
        ("Database Management Lab", "code"),
        ("Microprocessor Lab", "chemistry"),
        ("Internet of Things", "network"),
        ("Web Development", "world"),
    ],
    (2025, 2029, "Computer Science", 2): [
        ("Engineering Mathematics - II", "math"),
        ("Engineering Physics", "science"),
        ("Basic Electronics Engineering", "chip"),
        ("Engineering Mechanics", "law"),
        ("Programming and Problem Solving (PPS)", "code"),
        ("Project Based Learning / Ideation Labs", "chemistry"),
        ("Democracy, Election and Governance", "world"),
    ],
}

# --- units per course: (start_year, end_year, department, semester, course) -> [unit names in order] ---
UNITS: dict[tuple[int, int, str, int, str], list[str]] = {
    (2022, 2026, "Computer Science", 8, "Deep Learning"): [
        "Foundations of Deep Learning",
        "Deep Neural Networks (DNNs)",
        "Introduction to CNN",
        "Convolution Neural Network (CNN)",
        "Deep Generative Models",
        "Reinforcement Learning",
    ],
}


def run() -> None:
    seed_admin()  # ensure the bootstrap admin exists
    counts = {"batches": 0, "departments": 0, "semesters": 0, "courses": 0, "units": 0}

    with session_scope() as db:
        admin = db.scalar(select(User).where(User.role == UserRole.ADMIN))
        if admin is None:
            raise SystemExit("No admin found; set ADMIN_* in .env and retry.")

        for start, end in BATCHES:
            batch = db.scalar(select(Batch).where(Batch.start_year == start, Batch.end_year == end))
            if batch is None:
                batch = Batch(created_by=admin.id, start_year=start, end_year=end)
                db.add(batch)
                db.flush()
                counts["batches"] += 1

            for dept_name, color in DEPARTMENTS:
                dept = db.scalar(
                    select(Department).where(
                        Department.batch_id == batch.id, Department.name == dept_name
                    )
                )
                if dept is None:
                    dept = Department(batch_id=batch.id, name=dept_name, color=color)
                    db.add(dept)
                    db.flush()
                    counts["departments"] += 1
                    for n in range(1, SEMESTERS_PER_DEPT + 1):
                        db.add(Semester(department_id=dept.id, number=n))
                        counts["semesters"] += 1

        db.flush()

        # courses
        for (start, end, dept_name, sem_no), subjects in COURSES.items():
            batch = db.scalar(select(Batch).where(Batch.start_year == start, Batch.end_year == end))
            dept = db.scalar(
                select(Department).where(Department.batch_id == batch.id, Department.name == dept_name)
            )
            sem = db.scalar(
                select(Semester).where(Semester.department_id == dept.id, Semester.number == sem_no)
            )
            for name, cover in subjects:
                if db.scalar(select(Course).where(Course.semester_id == sem.id, Course.name == name)):
                    continue
                db.add(Course(teacher_id=admin.id, semester_id=sem.id, name=name, cover=cover))
                counts["courses"] += 1

        db.flush()

        # units (under a specific course)
        for (start, end, dept_name, sem_no, course_name), unit_names in UNITS.items():
            batch = db.scalar(select(Batch).where(Batch.start_year == start, Batch.end_year == end))
            dept = db.scalar(
                select(Department).where(Department.batch_id == batch.id, Department.name == dept_name)
            )
            sem = db.scalar(
                select(Semester).where(Semester.department_id == dept.id, Semester.number == sem_no)
            )
            course = db.scalar(
                select(Course).where(Course.semester_id == sem.id, Course.name == course_name)
            )
            for i, name in enumerate(unit_names):
                if db.scalar(select(Unit).where(Unit.course_id == course.id, Unit.name == name)):
                    continue
                db.add(Unit(course_id=course.id, name=name, order=i))
                counts["units"] += 1

        db.commit()

    print(f"seed_demo done: {counts}")


if __name__ == "__main__":
    run()
