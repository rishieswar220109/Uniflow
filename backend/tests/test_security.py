"""Unit tests for password hashing and token primitives."""

import uuid

import jwt
import pytest

from app.core.security import (
    create_access_token,
    decode_access_token,
    generate_refresh_token,
    hash_password,
    hash_refresh_token,
    verify_password,
)


def test_password_is_argon2_hashed_and_verifiable() -> None:
    password = "CorrectHorse123"
    hashed = hash_password(password)
    assert hashed != password
    assert hashed.startswith("$argon2")
    assert verify_password(password, hashed) is True
    assert verify_password("WrongPassword123", hashed) is False


def test_same_password_produces_different_hashes() -> None:
    assert hash_password("SamePassword123") != hash_password("SamePassword123")


def test_malformed_hash_does_not_raise() -> None:
    assert verify_password("anything", "not-a-valid-hash") is False


def test_refresh_tokens_are_random_and_only_hash_is_stable() -> None:
    raw_one, hash_one = generate_refresh_token()
    raw_two, hash_two = generate_refresh_token()
    assert raw_one != raw_two
    assert hash_one == hash_refresh_token(raw_one)
    assert hash_one != raw_one
    assert len(hash_one) == 64


def test_access_token_round_trip() -> None:
    user_id = uuid.uuid4()
    session_id = uuid.uuid4()
    token, expires_in = create_access_token(user_id=user_id, session_id=session_id)
    payload = decode_access_token(token)
    assert payload["sub"] == str(user_id)
    assert payload["sid"] == str(session_id)
    assert expires_in == 15 * 60


def test_tampered_access_token_is_rejected() -> None:
    token, _ = create_access_token(user_id=uuid.uuid4(), session_id=uuid.uuid4())
    with pytest.raises(jwt.InvalidTokenError):
        decode_access_token(token + "x")


def test_token_with_bad_signature_is_rejected() -> None:
    token = jwt.encode(
        {
            "sub": str(uuid.uuid4()),
            "sid": str(uuid.uuid4()),
            "type": "access",
            "iat": 1,
            "exp": 9999999999,
        },
        "a-different-secret-that-is-long-enough-for-hs256",
        algorithm="HS256",
    )
    with pytest.raises(jwt.InvalidTokenError):
        decode_access_token(token)
