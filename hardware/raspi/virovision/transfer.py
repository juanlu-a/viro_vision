"""Splitting a payload into chunks to send it over GATT notifications.

A PURE module (no BlueZ, no asyncio) on purpose: it is the only part of the transfer that can fail
through an arithmetic mistake, and the number it produces decides ADR 0003. It is tested on the Mac.

Format of each chunk: a 4-byte header + data.
    seq   uint16 LE  chunk index, from 0
    total uint16 LE  total number of chunks
The BLE link delivers notifications in order and without loss while the connection lives; `seq` is
there so the receiver can detect a connection that dropped and came back, not to reorder.
"""

from __future__ import annotations

import struct
from dataclasses import dataclass

HEADER = struct.Struct("<HH")
HEADER_BYTES = HEADER.size
# 65535 chunks is the uint16 ceiling; with 20-byte chunks (the minimum MTU) that is 1 MB, far above
# any photo that travels (53 KB at 1024 px).
MAX_CHUNKS = 0xFFFF
# The default ATT MTU is 23 → 20 bytes of notification payload. Anything smaller does not exist.
MIN_CHUNK = HEADER_BYTES + 1


class InvalidChunkError(ValueError):
    """The requested chunk size leaves no room for data, or the payload exceeds the possible chunks."""


@dataclass(frozen=True)
class TransferPlan:
    total_bytes: int
    chunk_size: int
    chunk_count: int

    @property
    def data_per_chunk(self) -> int:
        return self.chunk_size - HEADER_BYTES


def plan_transfer(total_bytes: int, chunk_size: int) -> TransferPlan:
    """How many chunks are needed. `chunk_size` is the total notification size (header included),
    i.e. MTU - 3 on the receiver's side."""
    if chunk_size < MIN_CHUNK:
        raise InvalidChunkError(f"chunk of {chunk_size} bytes: the header already takes {HEADER_BYTES}")
    if total_bytes < 0:
        raise InvalidChunkError("negative bytes")
    data = chunk_size - HEADER_BYTES
    count = max(1, -(-total_bytes // data))  # ceil; an empty payload still travels in 1 chunk
    if count > MAX_CHUNKS:
        raise InvalidChunkError(f"{count} chunks exceed the header's uint16")
    return TransferPlan(total_bytes, chunk_size, count)


def split(payload: bytes, chunk_size: int) -> list[bytes]:
    plan = plan_transfer(len(payload), chunk_size)
    data = plan.data_per_chunk
    return [
        HEADER.pack(seq, plan.chunk_count) + payload[seq * data : (seq + 1) * data]
        for seq in range(plan.chunk_count)
    ]


def join(chunks: list[bytes]) -> bytes:
    """The inverse of `split`. It exists for the round-trip test and to simulate the receiver."""
    if not chunks:
        raise InvalidChunkError("no chunks")
    parts: dict[int, bytes] = {}
    declared_total = None
    for chunk in chunks:
        seq, total = HEADER.unpack_from(chunk)
        if declared_total is None:
            declared_total = total
        elif total != declared_total:
            raise InvalidChunkError(f"inconsistent total: {total} vs {declared_total}")
        parts[seq] = chunk[HEADER_BYTES:]
    missing = [seq for seq in range(declared_total or 0) if seq not in parts]
    if missing:
        raise InvalidChunkError(f"missing chunks: {missing[:5]}{'…' if len(missing) > 5 else ''}")
    return b"".join(parts[seq] for seq in range(declared_total or 0))
