"""Exists because the throughput measured with these chunks decides ADR 0003 (is BLE enough for the
photo or is WiFi needed?). A mis-packed header or one chunk too many inflates or shrinks the number
and decides an architecture wrongly, with no visible error on the device."""

import os
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from virovision.transfer import (  # noqa: E402
    HEADER_BYTES,
    InvalidChunkError,
    join,
    split,
    plan_transfer,
)


def test_round_trip_recovers_the_payload():
    payload = os.urandom(53_000)
    chunks = split(payload, 182)
    assert join(chunks) == payload


def test_chunk_count_is_the_ceiling_of_bytes_over_data():
    # 182 - 4 = 178 bytes of data per chunk → 53 000 / 178 = 297.75 → 298 chunks
    plan = plan_transfer(53_000, 182)
    assert plan.data_per_chunk == 178
    assert plan.chunk_count == 298


def test_every_chunk_respects_the_size_and_the_header():
    chunks = split(b"x" * 1000, 100)
    assert all(len(c) <= 100 for c in chunks)
    assert len(chunks[0]) == 100
    seq0, total0 = int.from_bytes(chunks[0][:2], "little"), int.from_bytes(chunks[0][2:4], "little")
    assert (seq0, total0) == (0, len(chunks))
    last = chunks[-1]
    assert int.from_bytes(last[:2], "little") == len(chunks) - 1
    assert len(last) == HEADER_BYTES + (1000 - 96 * (len(chunks) - 1))


def test_empty_payload_travels_in_one_chunk():
    chunks = split(b"", 20)
    assert len(chunks) == 1
    assert join(chunks) == b""


def test_a_chunk_with_no_room_for_data_is_an_error():
    with pytest.raises(InvalidChunkError):
        plan_transfer(10, HEADER_BYTES)


def test_join_detects_missing_chunks():
    chunks = split(b"y" * 500, 24)
    del chunks[3]
    with pytest.raises(InvalidChunkError, match="missing"):
        join(chunks)
