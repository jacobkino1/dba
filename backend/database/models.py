from sqlalchemy import Column, String, DateTime, Boolean, Text
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
    organisationId = Column(String, nullable=False)
    name = Column(String)
    createdAt = Column(DateTime, default=datetime.utcnow)


class User(Base):
    __tablename__ = "users"

    userId = Column(String, primary_key=True)
    email = Column(String, nullable=True, unique=True)
    username = Column(String, nullable=True, unique=True)
    accountType = Column(String, nullable=False, default="work")  # work | workstation | service
    displayName = Column(String, nullable=False)
    status = Column(String, nullable=False, default="active")  # active | invited | disabled
    createdAt = Column(DateTime, default=datetime.utcnow)
    passwordHash = Column(String, nullable=True)
    lastLoginAt = Column(DateTime, nullable=True)
    mustSetPassword = Column(Boolean, nullable=False, default=False)


class OrganisationMembership(Base):
    __tablename__ = "organisation_memberships"

    membershipId = Column(String, primary_key=True)
    userId = Column(String, nullable=False)
    organisationId = Column(String, nullable=False)
    permissionLevel = Column(String, nullable=False)  # admin | manage | write | read
    createdBy = Column(String, nullable=True)
    createdAt = Column(DateTime, default=datetime.utcnow)


class ClinicMembership(Base):
    __tablename__ = "clinic_memberships"

    membershipId = Column(String, primary_key=True)
    userId = Column(String, nullable=False)
    organisationId = Column(String, nullable=False)
    clinicId = Column(String, nullable=False)
    permissionLevel = Column(String, nullable=False)  # admin | manage | write | read
    createdBy = Column(String, nullable=True)
    createdAt = Column(DateTime, default=datetime.utcnow)


class Document(Base):
    __tablename__ = "documents"

    documentId = Column(String, primary_key=True)

    organisationId = Column(String, nullable=False)
    clinicId = Column(String, nullable=True)

    filename = Column(String, nullable=False)
    documentType = Column(String, nullable=False)
    roleAccess = Column(String, nullable=False)  # read | write | manage | admin
    sourceType = Column(String, nullable=False)

    sourceUrl = Column(String, nullable=True)

    isShared = Column(Boolean, default=False)
    isCurrentVerified = Column(Boolean, default=True)

    uploadedBy = Column(String, nullable=True)
    uploadedAt = Column(DateTime, default=datetime.utcnow)

    status = Column(String, default="active")

    storageProvider = Column(String, nullable=False, default="local")
    storagePath = Column(String, nullable=True)

    indexStatus = Column(String, nullable=False, default="pending")
    indexError = Column(Text, nullable=True)
    indexedAt = Column(DateTime, nullable=True)

    readiness = Column(String, nullable=True)
    readinessNotes = Column(String, nullable=True)


class DocumentAuditLog(Base):
    __tablename__ = "document_audit_logs"

    auditId = Column(String, primary_key=True)

    documentId = Column(String, nullable=True)
    oldDocumentId = Column(String, nullable=True)
    newDocumentId = Column(String, nullable=True)

    organisationId = Column(String, nullable=False)
    clinicId = Column(String, nullable=True)

    action = Column(String, nullable=False)
    performedBy = Column(String, nullable=True)
    performedAt = Column(DateTime, default=datetime.utcnow)

    filename = Column(String, nullable=True)
    notes = Column(Text, nullable=True)


class Conversation(Base):
    __tablename__ = "conversations"

    conversationId = Column(String, primary_key=True)

    organisationId = Column(String, nullable=False)
    clinicId = Column(String, nullable=False)

    createdByUserId = Column(String, nullable=False)
    title = Column(String, nullable=True)

    status = Column(String, nullable=False, default="active")  # active | archived

    createdAt = Column(DateTime, default=datetime.utcnow)
    updatedAt = Column(DateTime, default=datetime.utcnow)


class ConversationMessage(Base):
    __tablename__ = "conversation_messages"

    messageId = Column(String, primary_key=True)

    conversationId = Column(String, nullable=False)
    organisationId = Column(String, nullable=False)
    clinicId = Column(String, nullable=False)

    userId = Column(String, nullable=True)
    role = Column(String, nullable=False)  # user | assistant
    content = Column(Text, nullable=False)

    sourceJson = Column(Text, nullable=True)

    createdAt = Column(DateTime, default=datetime.utcnow)


class AskLog(Base):
    __tablename__ = "ask_logs"

    askLogId = Column(String, primary_key=True)

    organisationId = Column(String, nullable=False)
    clinicId = Column(String, nullable=True)
    userId = Column(String, nullable=False)
    conversationId = Column(String, nullable=True)

    question = Column(Text, nullable=False)
    outcomeStatus = Column(String, nullable=False)  # answered | no_relevant_docs | model_error
    failureReason = Column(String, nullable=True)

    createdAt = Column(DateTime, default=datetime.utcnow)


class NetworkAccess(Base):
    __tablename__ = "network_access"

    networkAccessId = Column(String, primary_key=True)

    organisationId = Column(String, nullable=False)
    clinicId = Column(String, nullable=False)

    mode = Column(String, nullable=False, default="public")  # public | restricted

    createdAt = Column(DateTime, default=datetime.utcnow)
    updatedAt = Column(DateTime, default=datetime.utcnow)


class AllowedIP(Base):
    __tablename__ = "allowed_ips"

    allowedIpId = Column(String, primary_key=True)

    organisationId = Column(String, nullable=False)
    clinicId = Column(String, nullable=False)

    value = Column(String, nullable=False)  # single IPv4 or CIDR
    label = Column(String, nullable=True)

    createdAt = Column(DateTime, default=datetime.utcnow)