from sqlalchemy import Column, String, DateTime, Boolean
from datetime import datetime
from .db import Base


class Organisation(Base):
    __tablename__ = "organisations"

    organisationId = Column(String, primary_key=True)
    name = Column(String)
    createdAt = Column(DateTime, default=datetime.utcnow)


class Clinic(Base):
    __tablename__ = "clinics"

    clinicId = Column(String, primary_key=True)
    organisationId = Column(String)
    name = Column(String)
    createdAt = Column(DateTime, default=datetime.utcnow)


class Document(Base):
    __tablename__ = "documents"

    documentId = Column(String, primary_key=True)

    organisationId = Column(String, nullable=False)
    clinicId = Column(String, nullable=True)

    filename = Column(String, nullable=False)
    documentType = Column(String, nullable=False)
    roleAccess = Column(String, nullable=False)
    sourceType = Column(String, nullable=False)

    sourceUrl = Column(String, nullable=True)

    isShared = Column(Boolean, default=False)
    isCurrentVerified = Column(Boolean, default=True)

    uploadedBy = Column(String, nullable=True)
    uploadedAt = Column(DateTime, default=datetime.utcnow)

    status = Column(String, default="active")