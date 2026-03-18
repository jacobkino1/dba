from database.db import SessionLocal
from database.models import Organisation, Clinic
import uuid

db = SessionLocal()

# Create organisation
organisation = Organisation(
    organisationId=str(uuid.uuid4()),
    name="Dentist Example Test Org"
)

# Create clinic
clinic = Clinic(
    clinicId=str(uuid.uuid4()),
    organisationId=organisation.organisationId,
    name="Demo Dental Clinic"
)

db.add(organisation)
db.add(clinic)

db.commit()

print("Test organisation and clinic created")
