from __future__ import annotations

import argparse
import hashlib
import os
import re
import shutil
import sqlite3
import tempfile
import unicodedata
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, Optional

import pdfplumber


CANONICAL_MANUFACTURERS = (
    ("AMAZONTRAF", "AMAZONTRAFOS"),
    ("BREDA MT", "BREDA MT"),
    ("BREDA SP", "BREDA SP"),
    ("CGC", "CGC TRANSFORMADORES"),
    ("CPFL", "CPFL SERVIÇOS"),
    ("COMTRAFO", "COMTRAFO"),
    ("ENERTRAFO", "ENERTRAFO"),
    ("TAMURA", "INDUSUL / TAMURA BRASIL"),
    ("INDUSUL", "INDUSUL / TAMURA BRASIL"),
    ("ISOTRAFO", "ISOTRAFO"),
    ("ITAIPU", "ITAIPU TRANSFORMADORES"),
    ("ITAM", "ITAM"),
    ("ITB", "ITB EQUIPAMENTOS ELÉTRICOS"),
    ("ITR", "ITR"),
    ("MACORIN", "MACORIN ENERGIA"),
    ("MEDRAL", "MEDRAL"),
    ("NANSEN", "NANSEN"),
    ("NOVA LOG", "NOVA LOGÍSTICA REVERSA"),
    ("POTENCIAL", "POTENCIAL"),
    ("QLUZ", "QLUZ"),
    ("REFORTRAFO", "REFORTRAFO"),
    ("RHEDE", "RHEDE"),
    ("RIO PRETO", "RIO PRETO"),
    ("ROMAGNOLE", "ROMAGNOLE"),
    ("SIGMA", "SIGMA"),
    ("TOSHIBA", "TOSHIBA"),
    ("TRAEL", "TRAEL"),
    ("TRANSTEC", "TRANSTEC"),
    ("UNILUZ", "UNILUZ"),
    ("WEG", "WEG"),
    ("ZAGO", "ZAGO / INCOTRAZA"),
    ("INCOTRAZA", "ZAGO / INCOTRAZA"),
)


@dataclass(frozen=True)
class TableLayout:
    model: int
    label: int
    power: int
    voltage: int
    pedestal: Optional[int]
    loss_start: int
    temperature_start: int
    material_start: int
    nbi: int


def normalized(value: object) -> str:
    text = unicodedata.normalize("NFKD", str(value or ""))
    return "".join(char for char in text if not unicodedata.combining(char)).upper()


def clean_text(value: object) -> Optional[str]:
    text = re.sub(r"\s+", " ", str(value or "")).strip()
    return text or None


def number(value: object) -> Optional[float]:
    text = clean_text(value)
    if not text or text in {"_", "-", "–", "—"}:
        return None
    text = text.replace(".", "").replace(",", ".") if "," in text else text
    try:
        return float(text)
    except ValueError:
        return None


def flag(value: object) -> int:
    return 1 if normalized(value).strip() in {"X", "×"} else 0


def phase_type(value: object, previous: Optional[str]) -> Optional[str]:
    text = normalized(value)
    if "MONO" in text:
        return "MONOFASICO"
    if "TRI" in text:
        return "TRIFASICO"
    return previous


def manufacturer_from_row(row: list[object], previous: Optional[str]) -> Optional[str]:
    # The certification number is used only to repair the manufacturer name during
    # extraction. It is intentionally never persisted in the SQLite database.
    for search_area in (" ".join(str(value or "") for value in row[2:4]), str(row[0] or "")):
        search = normalized(search_area)
        for marker, manufacturer in CANONICAL_MANUFACTURERS:
            if marker in search:
                return manufacturer
    return previous


def infer_phase(
    current: Optional[str], model: Optional[str], power_kva: float, nominal_total: Optional[float], reconditioned: bool
) -> str:
    model_key = normalized(model).replace(" ", "")
    if "1F" in model_key or model_key.startswith(("TDM", "TM/", "TM(", "TM-")):
        return "MONOFASICO"
    if "3F" in model_key or model_key.startswith(("TDT", "TDC")):
        return "TRIFASICO"
    if not reconditioned:
        if power_kva in {5.0, 10.0, 25.0, 37.5, 50.0}:
            return "MONOFASICO"
        if power_kva in {30.0, 45.0, 75.0, 112.5, 150.0, 225.0, 300.0, 500.0, 750.0, 1000.0}:
            return "TRIFASICO"
        if power_kva == 15.0 and nominal_total is not None:
            return "MONOFASICO" if nominal_total <= 320 else "TRIFASICO"
    return current or "TRIFASICO"


def detect_layout(table: list[list[object]], reconditioned: bool) -> TableLayout:
    for row in table:
        normalized_row = [normalized(value) for value in row]
        if not any("POTENCIA" in value for value in normalized_row):
            continue
        model = next((i for i, value in enumerate(normalized_row) if "MODELO" in value), 2)
        label = next((i for i, value in enumerate(normalized_row) if "ETIQUETA" in value), model + 1)
        power = next((i for i, value in enumerate(normalized_row) if "POTENCIA" in value), None)
        voltage = next((i for i, value in enumerate(normalized_row) if "TENSAO" in value), None)
        if power is None or voltage is None:
            continue
        pedestal = next((i for i, value in enumerate(normalized_row) if "PEDESTAL" in value), None)
        loss_start = next((i for i, value in enumerate(normalized_row) if "PERDAS" in value), voltage + (1 if reconditioned else 2))
        temperature_start = next((i for i, value in enumerate(normalized_row) if "ELEVACAO" in value), loss_start + 8)
        material_start = next(
            (
                i
                for i, value in enumerate(normalized_row)
                if "MATERIAL" in value.replace(" ", "") or "MADTEORIAL" in value.replace(" ", "")
            ),
            temperature_start + 3,
        )
        return TableLayout(
            model=model,
            label=label,
            power=power,
            voltage=voltage,
            pedestal=None if reconditioned else pedestal,
            loss_start=loss_start,
            temperature_start=temperature_start,
            material_start=material_start,
            nbi=len(row) - 1,
        )
    for row in table:
        for index in range(2, len(row) - 1):
            power_value = number(row[index])
            voltage_value = number(row[index + 1])
            if (
                power_value is None
                or voltage_value is None
                or power_value <= 0
                or round(voltage_value, 1) not in {15.0, 24.2, 36.2, 36.5}
            ):
                continue
            loss_start = index + (2 if reconditioned else 3)
            return TableLayout(
                model=index - 2,
                label=index - 1,
                power=index,
                voltage=index + 1,
                pedestal=None if reconditioned else index + 2,
                loss_start=loss_start,
                temperature_start=loss_start + 8,
                material_start=loss_start + 11,
                nbi=len(row) - 1,
            )
    raise ValueError("Cabeçalho da tabela PBE não identificado.")


def cell(row: list[object], index: int) -> object:
    return row[index] if 0 <= index < len(row) else None


def source_rows(path: Path, category: str) -> list[dict[str, object]]:
    result: list[dict[str, object]] = []
    current_manufacturer: Optional[str] = None
    current_phase: Optional[str] = None
    reconditioned = category == "RECONDICIONADO"

    with pdfplumber.open(path) as pdf:
        for page_number, page in enumerate(pdf.pages, start=1):
            tables = page.extract_tables(
                {
                    "vertical_strategy": "lines",
                    "horizontal_strategy": "lines",
                    "intersection_tolerance": 5,
                    "snap_tolerance": 3,
                    "join_tolerance": 3,
                }
            )
            for table in tables:
                layout = detect_layout(table, reconditioned)
                for table_row, row in enumerate(table, start=1):
                    current_manufacturer = manufacturer_from_row(row, current_manufacturer)
                    current_phase = phase_type(cell(row, 1), current_phase)
                    power_kva = number(cell(row, layout.power))
                    voltage_class_kv = number(cell(row, layout.voltage))
                    if power_kva is None or voltage_class_kv is None:
                        continue

                    losses = [number(cell(row, layout.loss_start + offset)) for offset in range(8)]
                    nominal_pair = next(
                        ((losses[i], losses[i + 1]) for i in (0, 2) if losses[i] is not None and losses[i + 1] is not None),
                        (None, None),
                    )
                    nominal_no_load, nominal_total = nominal_pair
                    derived_load = (
                        nominal_total - nominal_no_load
                        if nominal_total is not None and nominal_no_load is not None
                        else None
                    )
                    efficiency = (
                        power_kva * 1000 / (power_kva * 1000 + nominal_total) * 100
                        if nominal_total is not None and nominal_total >= 0
                        else None
                    )
                    model = clean_text(cell(row, layout.model))
                    resolved_phase = infer_phase(
                        current_phase, model, power_kva, nominal_total, reconditioned
                    )
                    result.append(
                        {
                            "id": f"PBE-{'REC' if reconditioned else 'NOV'}-{page_number:02d}-{table_row:03d}",
                            "category": category,
                            "manufacturer": current_manufacturer or "FABRICANTE NÃO IDENTIFICADO",
                            "phaseType": resolved_phase,
                            "model": model,
                            "powerKva": power_kva,
                            "voltageClassKv": voltage_class_kv,
                            "pedestal": None if layout.pedestal is None else (1 if normalized(cell(row, layout.pedestal)) in {"SIM", "S"} else 0),
                            "nominalConventionalNoLoadW": losses[0],
                            "nominalConventionalTotalW": losses[1],
                            "nominalReliableNoLoadW": losses[2],
                            "nominalReliableTotalW": losses[3],
                            "criticalConventionalNoLoadW": losses[4],
                            "criticalConventionalTotalW": losses[5],
                            "criticalReliableNoLoadW": losses[6],
                            "criticalReliableTotalW": losses[7],
                            "temperatureRise55C": flag(cell(row, layout.temperature_start)),
                            "temperatureRise65C": flag(cell(row, layout.temperature_start + 1)),
                            "temperatureRise75C": flag(cell(row, layout.temperature_start + 2)),
                            "windingCopper": flag(cell(row, layout.material_start)),
                            "windingAluminum": flag(cell(row, layout.material_start + 1)),
                            "nbiKv": clean_text(cell(row, layout.nbi)),
                            "derivedLoadLossW": derived_load,
                            "efficiencyPercent": efficiency,
                            "sourcePage": page_number,
                        }
                    )
    return result


def etu_limits(connection: sqlite3.Connection) -> dict[tuple[str, float, float], list[tuple[str, float, float]]]:
    limits: dict[tuple[str, float, float], list[tuple[str, float, float]]] = {}
    for phase, power, voltage, source, no_load, total in connection.execute(
        """
        SELECT phaseType, powerKva, voltageClassKv, sourceDocument, noLoadLossW, totalLossW
        FROM transformers
        WHERE sourceDocument IN ('ETU 109.1', 'ETU 109.2')
        """
    ):
        limits.setdefault((phase, float(power), float(voltage)), []).append(
            (str(source), float(no_load), float(total))
        )
    return limits


def validate(row: dict[str, object], limits: dict[tuple[str, float, float], list[tuple[str, float, float]]]) -> tuple[str, str, int]:
    pairs = [
        (row["nominalConventionalNoLoadW"], row["nominalConventionalTotalW"], "convencional"),
        (row["nominalReliableNoLoadW"], row["nominalReliableTotalW"], "religável"),
    ]
    available = [(float(p0), float(pt), label) for p0, pt, label in pairs if p0 is not None and pt is not None]
    voltage = float(row["voltageClassKv"])
    structural_issues: list[str] = []
    if round(voltage, 1) not in {15.0, 24.2, 36.2}:
        structural_issues.append(f"classe de tensão {voltage:g} kV fora das classes 15/24,2/36,2 kV")
    for p0, total, label in available:
        if total < p0:
            structural_issues.append(f"perda total {label} menor que a perda em vazio")
    if structural_issues:
        return "DADOS_INCONSISTENTES", "; ".join(structural_issues), 0
    if not available:
        return (
            "SEM_DADOS_DE_PERDAS",
            "O PBE não informa perdas nem modelo nesta linha; configuração preservada sem inventar valores.",
            0,
        )

    key = (str(row["phaseType"]), float(row["powerKva"]), voltage)
    references = limits.get(key, [])
    if not references:
        return (
            "COERENTE_SEM_REFERENCIA_ETU",
            "Perdas aritmeticamente coerentes; não há combinação equivalente nas tabelas ETU 109.1/109.2 carregadas.",
            1,
        )
    compliant_sources: set[str] = set()
    for source, limit_p0, limit_total in references:
        if all(p0 <= limit_p0 + 0.01 and total <= limit_total + 0.01 for p0, total, _ in available):
            compliant_sources.add(source)
    if compliant_sources:
        sources = " e ".join(sorted(compliant_sources))
        return (
            "COERENTE_ETU",
            f"Perdas nominais declaradas não excedem os limites de nível C da {sources}; o PDF não identifica o tipo de óleo.",
            1,
        )
    return (
        "ACIMA_LIMITE_ETU",
        "Ao menos uma variante nominal declarada excede os limites das combinações ETU equivalentes; revisar óleo e aplicação.",
        1,
    )


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def update_database(database: Path, new_pdf: Path, reconditioned_pdf: Path) -> None:
    rows = source_rows(new_pdf, "NOVO") + source_rows(reconditioned_pdf, "RECONDICIONADO")
    database.parent.mkdir(parents=True, exist_ok=True)
    file_descriptor, temporary_name = tempfile.mkstemp(suffix=".sqlite", dir=database.parent)
    os.close(file_descriptor)
    temporary = Path(temporary_name)
    shutil.copy2(database, temporary)
    try:
        connection = sqlite3.connect(temporary)
        try:
            limits = etu_limits(connection)
            connection.executescript(
                """
                DROP TABLE IF EXISTS inmetro_models;
                CREATE TABLE inmetro_models (
                    id TEXT PRIMARY KEY,
                    category TEXT NOT NULL CHECK (category IN ('NOVO','RECONDICIONADO')),
                    manufacturer TEXT NOT NULL,
                    phaseType TEXT NOT NULL CHECK (phaseType IN ('MONOFASICO','TRIFASICO')),
                    model TEXT,
                    powerKva REAL NOT NULL,
                    voltageClassKv REAL NOT NULL,
                    pedestal INTEGER CHECK (pedestal IN (0,1) OR pedestal IS NULL),
                    nominalConventionalNoLoadW REAL,
                    nominalConventionalTotalW REAL,
                    nominalReliableNoLoadW REAL,
                    nominalReliableTotalW REAL,
                    criticalConventionalNoLoadW REAL,
                    criticalConventionalTotalW REAL,
                    criticalReliableNoLoadW REAL,
                    criticalReliableTotalW REAL,
                    temperatureRise55C INTEGER NOT NULL CHECK (temperatureRise55C IN (0,1)),
                    temperatureRise65C INTEGER NOT NULL CHECK (temperatureRise65C IN (0,1)),
                    temperatureRise75C INTEGER NOT NULL CHECK (temperatureRise75C IN (0,1)),
                    windingCopper INTEGER NOT NULL CHECK (windingCopper IN (0,1)),
                    windingAluminum INTEGER NOT NULL CHECK (windingAluminum IN (0,1)),
                    nbiKv TEXT,
                    derivedLoadLossW REAL,
                    efficiencyPercent REAL,
                    validationStatus TEXT NOT NULL,
                    validationNote TEXT NOT NULL,
                    diagnosticReady INTEGER NOT NULL CHECK (diagnosticReady IN (0,1)),
                    sourceDocument TEXT NOT NULL,
                    sourcePage INTEGER NOT NULL
                ) WITHOUT ROWID;
                CREATE INDEX inmetro_models_filter_idx
                    ON inmetro_models(category, phaseType, manufacturer, powerKva, voltageClassKv);
                """
            )
            insert_sql = """
                INSERT INTO inmetro_models VALUES (
                    :id, :category, :manufacturer, :phaseType, :model, :powerKva, :voltageClassKv, :pedestal,
                    :nominalConventionalNoLoadW, :nominalConventionalTotalW,
                    :nominalReliableNoLoadW, :nominalReliableTotalW,
                    :criticalConventionalNoLoadW, :criticalConventionalTotalW,
                    :criticalReliableNoLoadW, :criticalReliableTotalW,
                    :temperatureRise55C, :temperatureRise65C, :temperatureRise75C,
                    :windingCopper, :windingAluminum, :nbiKv, :derivedLoadLossW, :efficiencyPercent,
                    :validationStatus, :validationNote, :diagnosticReady, :sourceDocument, :sourcePage
                )
            """
            for row in rows:
                status, note, ready = validate(row, limits)
                row.update(
                    validationStatus=status,
                    validationNote=note,
                    diagnosticReady=ready,
                    sourceDocument=(
                        "PBE INMETRO - Transformadores novos Curva C (24/06/2026)"
                        if row["category"] == "NOVO"
                        else "PBE INMETRO - Transformadores recondicionados (10/04/2026)"
                    ),
                )
                connection.execute(insert_sql, row)

            metadata = {
                "schema_version": "3",
                "generated_at": "2026-08-01",
                "inmetro_model_count": str(len(rows)),
                "inmetro_new_count": str(sum(row["category"] == "NOVO" for row in rows)),
                "inmetro_reconditioned_count": str(sum(row["category"] == "RECONDICIONADO" for row in rows)),
            }
            connection.executemany(
                "INSERT OR REPLACE INTO database_metadata(key, value) VALUES (?, ?)", metadata.items()
            )
            connection.executemany(
                "INSERT OR REPLACE INTO source_documents(code,title,version,date,fileName,sha256,usedPages) VALUES (?,?,?,?,?,?,?)",
                [
                    (
                        "INMETRO_PBE_CURVA_C_2026",
                        "Tabela de eficiência - transformadores novos monofásicos e trifásicos",
                        "Curva C",
                        "2026-06-24",
                        new_pdf.name,
                        sha256(new_pdf),
                        "1-14",
                    ),
                    (
                        "INMETRO_PBE_RECOND_2026",
                        "Tabela de eficiência - transformadores recondicionados monofásicos e trifásicos",
                        "Recondicionados",
                        "2026-04-10",
                        reconditioned_pdf.name,
                        sha256(reconditioned_pdf),
                        "1-9",
                    ),
                ],
            )
            connection.commit()
            connection.execute("VACUUM")
            print("rows", len(rows))
            for category, count in connection.execute(
                "SELECT category, COUNT(*) FROM inmetro_models GROUP BY category ORDER BY category"
            ):
                print(category, count)
            for status, count in connection.execute(
                "SELECT validationStatus, COUNT(*) FROM inmetro_models GROUP BY validationStatus ORDER BY validationStatus"
            ):
                print(status, count)
        finally:
            connection.close()
        os.replace(temporary, database)
    except Exception:
        temporary.unlink(missing_ok=True)
        raise


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--database", type=Path, required=True)
    parser.add_argument("--new-pdf", type=Path, required=True)
    parser.add_argument("--reconditioned-pdf", type=Path, required=True)
    args = parser.parse_args()
    update_database(args.database.resolve(), args.new_pdf.resolve(), args.reconditioned_pdf.resolve())


if __name__ == "__main__":
    main()
