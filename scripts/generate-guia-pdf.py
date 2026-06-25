#!/usr/bin/env python3
"""Genera docs/guia-horariosl-profesorado.pdf"""
from pathlib import Path
from fpdf import FPDF

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "docs" / "guia-horariosl-profesorado.pdf"


class GuidePDF(FPDF):
    def footer(self):
        self.set_y(-15)
        self.set_font("Helvetica", "I", 8)
        self.set_text_color(148, 163, 184)
        self.cell(0, 10, "HorarioSL - Colegio San Lorenzo", align="C")


def body(pdf: FPDF, text: str):
    pdf.set_font("Helvetica", "", 11)
    pdf.set_text_color(26, 26, 26)
    pdf.multi_cell(0, 6, text)
    pdf.ln(2)


def section(pdf: FPDF, title: str, paragraphs: list[str]):
    if pdf.get_y() > 250:
        pdf.add_page()
    pdf.set_font("Helvetica", "B", 13)
    pdf.set_text_color(30, 58, 95)
    pdf.cell(0, 8, title, ln=True)
    for p in paragraphs:
        body(pdf, p)
    pdf.ln(3)


def main():
    pdf = GuidePDF()
    pdf.set_auto_page_break(auto=True, margin=20)
    pdf.add_page()

    pdf.set_font("Helvetica", "B", 22)
    pdf.set_text_color(30, 58, 95)
    pdf.cell(0, 12, "HorarioSL", ln=True)
    pdf.set_font("Helvetica", "", 12)
    pdf.set_text_color(100, 116, 139)
    pdf.cell(0, 8, "Guia para el profesorado", ln=True)
    pdf.cell(0, 6, "Colegio San Lorenzo", ln=True)
    pdf.cell(0, 6, "Como se configura y genera el horario escolar", ln=True)
    pdf.ln(8)

    body(
        pdf,
        "HorarioSL organiza el horario de todas las clases del centro de forma automatica. "
        "No es una agenda personal: es el cuadrante oficial de quien imparte que asignatura, "
        "en que curso y en que franja horaria. La configuracion la hace direccion o jefatura "
        "de estudios. Para cada profesor, lo decisivo es como esta dado de alta en el sistema.",
    )

    sections = [
        (
            "La idea en una frase",
            [
                "1. Cuantas horas hay que colocar en cada curso.",
                "2. En que huecos del dia pueden ir las clases.",
                "3. Que profesor puede impartir cada asignatura y cuando NO esta disponible.",
            ],
        ),
        (
            "1. Malla horaria - Como es el dia del cole",
            [
                "Define dias lectivos, hora de entrada y salida, recreos y bloques horarios.",
                "Para el profesorado: marca cuantos huecos hay a la semana y a que horas pueden caer las clases.",
                "IMPORTANTE: si se cambia la malla, hay que volver a revisar la disponibilidad de todos los profesores.",
            ],
        ),
        (
            "2. Subciclos",
            [
                "Agrupa cursos con el mismo curriculo. Ejemplo en Primaria: 1+2, 3+4, 5+6.",
            ],
        ),
        (
            "3. Curriculo obligatorio",
            [
                "Horas semanales por asignatura segun la ley (Anexo IV en Primaria).",
                "Es la referencia legal, no el horario definitivo.",
            ],
        ),
        (
            "4. Cursos",
            [
                "Los grupos del centro: 1A, 2B, 3C... Cada curso pertenece a un subciclo.",
            ],
        ),
        (
            "5. Asignaturas y horas por curso",
            [
                "Lista de asignaturas + matriz de horas semanales por curso.",
                "Si 4A tiene 4 h de Lengua, el generador intenta programar 4 clases esa semana.",
                "El total de horas de un curso no puede superar los huecos de la malla.",
            ],
        ),
        (
            "6. Profesores - La parte que mas os afecta",
            [
                "Nombre: como aparece en el horario.",
                "Asignaturas: que puede impartir cada docente.",
                "Ambito: todo el centro, solo un ciclo (ej. Primaria) o cursos concretos.",
                "Horas maximas por semana: tope de horas lectivas.",
                "Disponibilidad: franjas en las que NO puede dar clase (reuniones, reduccion, otro centro).",
                "Si la ficha esta mal: clases sin colocar, horarios imposibles o clases en franjas no disponibles.",
            ],
        ),
        (
            "7. Generar horario",
            [
                "El programa comprueba datos, calcula sesiones e intenta ubicarlas.",
                "Respeta: asignaturas del profesor, ambito, indisponibilidad, horas maximas, sin solapes.",
                "Si no puede colocar todo, el horario queda incompleto y se indica el motivo.",
                "Despues se pueden hacer ajustes manuales y exportar a Excel.",
            ],
        ),
        (
            "De horas a clases en el horario",
            [
                "3 h de Lengua con clases de 45 min = 3 sesiones en la semana.",
                "El dia se divide en bloques pequenos (ej. 15 min): una clase de 45 min ocupa 3 bloques seguidos.",
            ],
        ),
        (
            "Checklist - Que debe estar bien sobre cada profesor",
            [
                "- Nombre correcto en el sistema",
                "- Todas las asignaturas que imparte, marcadas",
                "- Ambito correcto (ciclo / cursos)",
                "- Horas maximas realistas",
                "- Disponibilidad actualizada tras cambios de malla",
                "- Horas definidas en la matriz para sus cursos",
                "- Si comparte asignatura con otro companero, ambos bien dados de alta",
            ],
        ),
        (
            "Problemas frecuentes",
            [
                "Clase en horario de reunion -> indisponibilidad no marcada.",
                "Falta una hora de una asignatura -> sin profesor habilitado o sin hueco.",
                "Nombres genericos (Prof. Mates) -> plantilla sin personalizar.",
                "Tras cambiar la malla, horarios raros -> se resetea la disponibilidad.",
                "Demasiadas horas -> horas maximas mal puestas o pocos profesores.",
            ],
        ),
        (
            "Lo que el sistema NO hace",
            [
                "- No decide criterios pedagogicos (ej. Mates por la manana)",
                "- No reparte automaticamente entre dos profes de la misma asignatura",
                "- No gestiona sustituciones, guardias ni aulas",
                "- No envia el horario individual por correo",
            ],
        ),
        (
            "Resumen del proceso",
            [
                "Malla horaria -> Cursos y horas -> Profesores y restricciones -> GENERAR -> Ajustes y Excel",
            ],
        ),
    ]

    for title, paragraphs in sections:
        section(pdf, title, paragraphs)

    pdf.add_page()
    pdf.set_font("Helvetica", "B", 14)
    pdf.set_text_color(30, 58, 95)
    pdf.cell(0, 10, "Formulario - Datos que cada profesor debe facilitar", ln=True)
    pdf.ln(4)

    pdf.set_font("Helvetica", "", 11)
    for label in [
        "Nombre y apellidos:",
        "Asignaturas que imparte:",
        "Cursos / grupos:",
        "Horas maximas semanales:",
    ]:
        pdf.cell(0, 8, label, ln=True)
        pdf.cell(0, 10, "_" * 70, ln=True)
        pdf.ln(2)

    pdf.ln(2)
    pdf.set_font("Helvetica", "B", 10)
    pdf.cell(45, 8, "Dia", border=1)
    pdf.cell(0, 8, "Franjas en las que NO puede dar clase", border=1, ln=True)
    pdf.set_font("Helvetica", "", 10)
    for day in ["Lunes", "Martes", "Miercoles", "Jueves", "Viernes"]:
        pdf.cell(45, 14, day, border=1)
        pdf.cell(0, 14, "", border=1, ln=True)

    pdf.ln(6)
    pdf.set_font("Helvetica", "", 11)
    pdf.cell(0, 8, "Observaciones:", ln=True)
    pdf.cell(0, 10, "_" * 70, ln=True)

    OUT.parent.mkdir(parents=True, exist_ok=True)
    pdf.output(str(OUT))
    print(f"PDF generado: {OUT}")


if __name__ == "__main__":
    main()
