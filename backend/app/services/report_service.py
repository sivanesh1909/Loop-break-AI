"""
PDF Report Generation Service using ReportLab.
"""
import io
import json
import logging
from datetime import datetime
from typing import Optional, List

logger = logging.getLogger("loopbreak.report")


def generate_report_pdf(session: dict, attempts: list, root_causes: list) -> bytes:
    """Generate a professional PDF troubleshooting report."""
    try:
        from reportlab.lib.pagesizes import A4
        from reportlab.lib import colors
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib.units import cm
        from reportlab.platypus import (
            SimpleDocTemplate, Paragraph, Spacer, Table,
            TableStyle, HRFlowable, KeepTogether
        )
        from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT

        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer, pagesize=A4,
            rightMargin=2*cm, leftMargin=2*cm,
            topMargin=2*cm, bottomMargin=2*cm
        )

        styles = getSampleStyleSheet()
        # Custom styles
        title_style = ParagraphStyle(
            'Title', parent=styles['Title'],
            fontSize=24, textColor=colors.HexColor('#6366f1'),
            spaceAfter=6
        )
        subtitle_style = ParagraphStyle(
            'Subtitle', parent=styles['Normal'],
            fontSize=12, textColor=colors.HexColor('#94a3b8'),
            spaceAfter=20
        )
        h2_style = ParagraphStyle(
            'H2', parent=styles['Heading2'],
            fontSize=14, textColor=colors.HexColor('#1e293b'),
            spaceBefore=16, spaceAfter=8,
            borderPad=4
        )
        body_style = ParagraphStyle(
            'Body', parent=styles['Normal'],
            fontSize=10, leading=14,
            textColor=colors.HexColor('#334155'),
            spaceAfter=6
        )
        small_style = ParagraphStyle(
            'Small', parent=styles['Normal'],
            fontSize=8, textColor=colors.HexColor('#64748b')
        )
        success_style = ParagraphStyle(
            'Success', parent=styles['Normal'],
            fontSize=11, textColor=colors.HexColor('#16a34a'),
            backColor=colors.HexColor('#f0fdf4'),
            borderPad=8, spaceAfter=12
        )

        story = []

        # ── Header ──────────────────────────────────────────
        story.append(Paragraph("LoopBreak AI", title_style))
        story.append(Paragraph("Troubleshooting Report", subtitle_style))
        story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor('#6366f1')))
        story.append(Spacer(1, 0.3*cm))

        # ── Meta ─────────────────────────────────────────────
        created = session.get('created_at', '')
        if hasattr(created, 'strftime'):
            created = created.strftime('%Y-%m-%d %H:%M UTC')
        resolved = session.get('resolved_at', '')
        if hasattr(resolved, 'strftime'):
            resolved = resolved.strftime('%Y-%m-%d %H:%M UTC')

        meta_data = [
            ['Session ID', session.get('id', 'N/A')],
            ['Status', session.get('status', 'unknown').upper()],
            ['Category', session.get('category', 'N/A').title()],
            ['Created', str(created)],
            ['Resolved', str(resolved) if resolved else 'In Progress'],
            ['Total Attempts', str(len(attempts))],
            ['Failed Attempts', str(sum(1 for a in attempts if a.get('user_feedback') == 'failed'))],
        ]
        meta_table = Table(meta_data, colWidths=[4*cm, 13*cm])
        meta_table.setStyle(TableStyle([
            ('FONTSIZE', (0,0), (-1,-1), 9),
            ('TEXTCOLOR', (0,0), (0,-1), colors.HexColor('#475569')),
            ('TEXTCOLOR', (1,0), (1,-1), colors.HexColor('#1e293b')),
            ('FONTNAME', (0,0), (0,-1), 'Helvetica-Bold'),
            ('ROWBACKGROUNDS', (0,0), (-1,-1), [colors.HexColor('#f8fafc'), colors.white]),
            ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#e2e8f0')),
            ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
            ('TOPPADDING', (0,0), (-1,-1), 4),
            ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ]))
        story.append(meta_table)
        story.append(Spacer(1, 0.4*cm))

        # ── Problem Summary ──────────────────────────────────
        story.append(Paragraph("Problem Summary", h2_style))
        story.append(Paragraph(f"<b>{session.get('title', 'N/A')}</b>", body_style))
        story.append(Paragraph(session.get('description', ''), body_style))
        if session.get('error_message'):
            story.append(Paragraph(f"<b>Error:</b> {session['error_message']}", body_style))

        # ── AI Understanding ─────────────────────────────────
        if session.get('ai_understanding'):
            story.append(Paragraph("AI Analysis", h2_style))
            story.append(Paragraph(session['ai_understanding'], body_style))

        # ── Resolution ──────────────────────────────────────
        if session.get('final_solution'):
            story.append(Paragraph("✓ Resolution", h2_style))
            story.append(Paragraph(session['final_solution'], success_style))

        if session.get('final_cause'):
            story.append(Paragraph(f"<b>Root Cause:</b> {session['final_cause']}", body_style))

        # ── Attempt History ──────────────────────────────────
        if attempts:
            story.append(Paragraph("Attempt History", h2_style))
            for i, attempt in enumerate(attempts):
                feedback = attempt.get('user_feedback', 'pending')
                feedback_color = {
                    'worked': '#16a34a', 'failed': '#dc2626',
                    'partial': '#d97706', 'skipped': '#64748b'
                }.get(feedback, '#475569')

                header = [
                    Paragraph(
                        f"<b>#{attempt.get('attempt_number', i+1)} — {attempt.get('action_title', 'Action')}</b>",
                        body_style
                    ),
                    Paragraph(
                        f"<font color='{feedback_color}'><b>{feedback.upper()}</b></font>",
                        body_style
                    )
                ]
                row_table = Table([header], colWidths=[13*cm, 4*cm])
                row_table.setStyle(TableStyle([
                    ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#f1f5f9')),
                    ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#e2e8f0')),
                    ('TOPPADDING', (0,0), (-1,-1), 6),
                    ('BOTTOMPADDING', (0,0), (-1,-1), 6),
                ]))
                story.append(row_table)

                if attempt.get('reasoning'):
                    story.append(Paragraph(f"<i>Reason:</i> {attempt['reasoning']}", small_style))
                if attempt.get('actual_result'):
                    story.append(Paragraph(f"<i>Result:</i> {attempt['actual_result']}", small_style))
                story.append(Spacer(1, 0.2*cm))

        # ── Root Causes ──────────────────────────────────────
        if root_causes:
            story.append(Paragraph("Root Cause Analysis", h2_style))
            for rc in root_causes:
                confidence = rc.get('confidence', 0)
                status = rc.get('status', 'hypothesis')
                story.append(Paragraph(
                    f"<b>{rc.get('cause', 'Unknown')}</b> "
                    f"[{status.upper()}, {int(confidence*100)}% confidence]",
                    body_style
                ))

        # ── Footer ───────────────────────────────────────────
        story.append(Spacer(1, 0.5*cm))
        story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor('#e2e8f0')))
        story.append(Paragraph(
            "Generated by LoopBreak AI — AI That Learns From What Didn't Work.",
            small_style
        ))

        doc.build(story)
        return buffer.getvalue()

    except ImportError:
        logger.error("ReportLab not available for PDF generation")
        # Fallback: plain text
        lines = [
            "LoopBreak AI — Troubleshooting Report",
            "=" * 50,
            f"Session: {session.get('id', 'N/A')}",
            f"Title: {session.get('title', 'N/A')}",
            f"Status: {session.get('status', 'N/A')}",
            "",
            "PROBLEM:",
            session.get('description', ''),
            "",
            "RESOLUTION:",
            session.get('final_solution', 'Not yet resolved'),
        ]
        for a in attempts:
            lines.append(f"\nAttempt #{a.get('attempt_number')}: {a.get('action_title')} [{a.get('user_feedback', 'pending')}]")
        return "\n".join(lines).encode("utf-8")

