from fastapi import APIRouter

from app.schemas import LoginRequest, User

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login")
def login(credentials: LoginRequest) -> User:
    """Stub sign-in: accepts any well-formed email and password.

    There is no authentication yet; the credentials are neither checked nor stored. Real sign up
    and sign in against the users table replace this in a later ticket.
    """
    return User(email=credentials.email)
