"""Existe porque el throughput medido con estos chunks decide el ADR 0003 (¿BLE alcanza para la
foto o hace falta WiFi?). Un header mal empaquetado o un chunk de más inflan o achican el número y
deciden mal una arquitectura, sin ningún error visible en la placa."""

import os
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from virovision.transferencia import (  # noqa: E402
    HEADER_BYTES,
    ChunkInvalidoError,
    armar,
    partir,
    planificar,
)


def test_ida_y_vuelta_recupera_el_payload():
    payload = os.urandom(53_000)
    chunks = partir(payload, 182)
    assert armar(chunks) == payload


def test_cantidad_de_chunks_es_el_techo_de_bytes_sobre_datos():
    # 182 - 4 = 178 bytes de datos por chunk → 53 000 / 178 = 297,75 → 298 chunks
    plan = planificar(53_000, 182)
    assert plan.datos_por_chunk == 178
    assert plan.cantidad_chunks == 298


def test_cada_chunk_respeta_el_tamano_y_el_header():
    chunks = partir(b"x" * 1000, 100)
    assert all(len(c) <= 100 for c in chunks)
    assert len(chunks[0]) == 100
    seq0, total0 = int.from_bytes(chunks[0][:2], "little"), int.from_bytes(chunks[0][2:4], "little")
    assert (seq0, total0) == (0, len(chunks))
    ultimo = chunks[-1]
    assert int.from_bytes(ultimo[:2], "little") == len(chunks) - 1
    assert len(ultimo) == HEADER_BYTES + (1000 - 96 * (len(chunks) - 1))


def test_payload_vacio_viaja_en_un_chunk():
    chunks = partir(b"", 20)
    assert len(chunks) == 1
    assert armar(chunks) == b""


def test_chunk_sin_lugar_para_datos_es_error():
    with pytest.raises(ChunkInvalidoError):
        planificar(10, HEADER_BYTES)


def test_armar_detecta_faltantes():
    chunks = partir(b"y" * 500, 24)
    del chunks[3]
    with pytest.raises(ChunkInvalidoError, match="faltan"):
        armar(chunks)
