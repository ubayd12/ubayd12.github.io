#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Membangun presentasi "Tata Perundang-undangan Indonesia" (16:9) dengan python-pptx.

Pemakaian:
    python3 build_deck.py [berkas_keluaran.pptx]

Seluruh teks slide, catatan presenter, dan rujukan pasal ada di berkas ini.
Ubah teks di sini, lalu jalankan ulang untuk membangun berkas .pptx yang baru.
"""
import re
import sys
import uuid

from lxml import etree
from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.enum.dml import MSO_LINE_DASH_STYLE
from pptx.enum.shapes import MSO_CONNECTOR, MSO_SHAPE, PP_PLACEHOLDER
from pptx.enum.text import MSO_ANCHOR, MSO_AUTO_SIZE, PP_ALIGN
from pptx.opc.constants import RELATIONSHIP_TYPE as RT
from pptx.oxml.ns import qn
from pptx.util import Inches, Pt

OUT = sys.argv[1] if len(sys.argv) > 1 else "Tata-Perundang-undangan-Indonesia.pptx"

# --------------------------------------------------------------------------
# Palet, tipografi, kisi
# --------------------------------------------------------------------------
NAVY, GOLD, IVORY, INK, MAROON = "0B1F3A", "C4A35A", "F7F4EE", "1C1C1C", "7A1F2B"
GOLD_DK = "7D5E18"     # emas tua: teks "emas" di atas latar terang (kontras > 5:1)
SLATE = "5A6270"       # teks footer di latar terang
WHITE = "FFFFFF"
ON_NAVY = "C9D1DE"     # teks sekunder di atas navy
GOLD_TINT = "F0E6CE"   # latar kotak "Akibat hukum"
CARD_LINE = "BFB49C"   # garis tepi kartu putih
NAVY_TINT = "D5DBE5"   # tingkat nonaktif pada piramida mini
NAVY_LOW = "1F3A63"    # navy paling terang pada gradasi piramida
HEAD, BODY = "Cambria", "Calibri"   # judul serif, isi sans-serif

SW, SH = 13.333, 7.5    # 16:9
M = 0.6                 # margin kiri dan kanan
CW = SW - 2 * M         # lebar area isi

ALIGN = {"l": PP_ALIGN.LEFT, "c": PP_ALIGN.CENTER, "r": PP_ALIGN.RIGHT}
ANCHOR = {"t": MSO_ANCHOR.TOP, "m": MSO_ANCHOR.MIDDLE, "b": MSO_ANCHOR.BOTTOM}
ROUND = MSO_SHAPE.ROUNDED_RECTANGLE

K1 = "BAB 1 · PERATURAN"
K2 = "BAB 2 · PENGERTIAN TATA PERUNDANG-UNDANGAN"
K3 = "BAB 3 · JENIS DAN TATA URUTAN"
K4 = "BAB 4 · IMPLEMENTASI"
SRC_UMUM = "Sumber: UU No. 12 Tahun 2011 jo. UU No. 15 Tahun 2019 dan UU No. 13 Tahun 2022"


def rgb(hex_):
    return RGBColor.from_string(hex_)


# --------------------------------------------------------------------------
# Teks
# --------------------------------------------------------------------------
NB_RE = re.compile(r"\b(Pasal|ayat|angka|huruf|No\.|Nomor|Tahun|UUD|UU|MPR|MPRS|Tap|Tingkat|tingkat|Slide|BAB|Bab) "
                   r"(?=\d|\(|No\.|MPR|[IVX]+[/\s.,)])")


def nb(text):
    """Ganti spasi sesudah label (Pasal, ayat, No., Tahun, ...) dengan spasi tak terputus."""
    return NB_RE.sub(lambda m: m.group(1) + "\u00a0", text)


def R(text, **style):
    """Satu run teks dengan gaya khusus."""
    return (text, style)


def P(*runs, align="l", after=0, before=0, line=None, bullet=None, **style):
    """Satu paragraf. Argumen string menjadi run dengan gaya `style`."""
    out = []
    for r in runs:
        if isinstance(r, str):
            out.append((r, dict(style)))
        else:
            text, st = r
            merged = dict(style)
            merged.update(st)
            out.append((text, merged))
    return {"runs": out, "align": align, "after": after, "before": before,
            "line": line, "bullet": bullet}


def style_run(run, size=18, color=INK, bold=False, italic=False, font=BODY, spc=None):
    f = run.font
    f.size = Pt(size)
    f.bold = bold
    f.italic = italic
    f.name = font
    f.color.rgb = rgb(color)
    rPr = run._r.get_or_add_rPr()
    rPr.set("lang", "id-ID")
    if spc is not None:
        rPr.set("spc", str(int(spc * 100)))


def add_bullet(para, color=GOLD_DK, char="■", indent=0.32):
    pPr = para._p.get_or_add_pPr()
    pPr.set("marL", str(int(Inches(indent))))
    pPr.set("indent", str(-int(Inches(indent))))
    bu_clr = etree.Element(qn("a:buClr"))
    etree.SubElement(bu_clr, qn("a:srgbClr")).set("val", color)
    bu_sz = etree.Element(qn("a:buSzPct"))
    bu_sz.set("val", "75000")
    bu_font = etree.Element(qn("a:buFont"))
    bu_font.set("typeface", "Arial")
    bu_char = etree.Element(qn("a:buChar"))
    bu_char.set("char", char)
    succ = None
    for tag in ("a:tabLst", "a:defRPr", "a:extLst"):
        succ = pPr.find(qn(tag))
        if succ is not None:
            break
    for el in (bu_clr, bu_sz, bu_font, bu_char):
        if succ is not None:
            succ.addprevious(el)
        else:
            pPr.append(el)


def fill_paras(tf, paras):
    for i, p in enumerate(paras):
        para = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        para.alignment = ALIGN[p["align"]]
        if p["line"]:
            para.line_spacing = p["line"]
        if p["before"]:
            para.space_before = Pt(p["before"])
        if p["after"]:
            para.space_after = Pt(p["after"])
        if p["bullet"]:
            add_bullet(para, color=p["bullet"])
        for text, st in p["runs"]:
            run = para.add_run()
            run.text = nb(text)
            style_run(run, **st)


def fill_tf(tf, paras, anchor="t", margins=(0, 0, 0, 0)):
    tf.word_wrap = True
    tf.auto_size = MSO_AUTO_SIZE.NONE
    left, top, right, bottom = margins
    tf.margin_left, tf.margin_top = Inches(left), Inches(top)
    tf.margin_right, tf.margin_bottom = Inches(right), Inches(bottom)
    tf.vertical_anchor = ANCHOR[anchor]
    fill_paras(tf, paras)


def add_text(sh, x, y, w, h, paras, anchor="t", margins=(0, 0, 0, 0), name=None):
    tb = sh.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h))
    fill_tf(tb.text_frame, paras, anchor=anchor, margins=margins)
    if name:
        tb.name = name
    return tb


def place(shape, x, y, w, h):
    shape.left, shape.top = Inches(x), Inches(y)
    shape.width, shape.height = Inches(w), Inches(h)


# --------------------------------------------------------------------------
# Bentuk
# --------------------------------------------------------------------------
def box(sh, kind, x, y, w, h, fill=None, line=None, line_w=1.0, dash=None,
        radius=0.08, paras=None, anchor="m", margins=(0.2, 0.1, 0.2, 0.1), name=None):
    shp = sh.add_shape(kind, Inches(x), Inches(y), Inches(w), Inches(h))
    style = shp._element.find(qn("p:style"))   # buang gaya bawaan (bayangan, garis tema)
    if style is not None:
        shp._element.remove(style)
    if fill:
        shp.fill.solid()
        shp.fill.fore_color.rgb = rgb(fill)
    else:
        shp.fill.background()
    if line:
        shp.line.color.rgb = rgb(line)
        shp.line.width = Pt(line_w)
        if dash is not None:
            shp.line.dash_style = dash
    else:
        shp.line.fill.background()
    if kind == ROUND:
        shp.adjustments[0] = min(0.5, radius / min(w, h))
    if paras is not None:
        fill_tf(shp.text_frame, paras, anchor=anchor, margins=margins)
    if name:
        shp.name = name
    return shp


def card(sh, x, y, w, h, fill=WHITE, line=CARD_LINE, line_w=1.0, **kw):
    return box(sh, ROUND, x, y, w, h, fill=fill, line=line, line_w=line_w, **kw)


def badge(sh, cx, cy, d, text, fill=NAVY, color=GOLD, size=22, font=HEAD, name=None):
    return box(sh, MSO_SHAPE.OVAL, cx - d / 2, cy - d / 2, d, d, fill=fill,
               paras=[P(text, size=size, bold=True, color=color, font=font, align="c")],
               anchor="m", margins=(0, 0, 0, 0), name=name or f"Nomor {text}")


def callout(sh, x, y, w, h, label, text, size=18, name="Akibat hukum"):
    return box(sh, ROUND, x, y, w, h, fill=GOLD_TINT,
               paras=[P(R(label, bold=True, color=NAVY), R(text), size=size)],
               anchor="m", margins=(0.3, 0.06, 0.3, 0.06), name=name)


def warn(sh, x, y, w, h, paras, name="Larangan"):
    """Kotak maroon: hanya untuk larangan atau konflik norma."""
    return box(sh, ROUND, x, y, w, h, fill=MAROON, paras=paras, anchor="m",
               margins=(0.3, 0.08, 0.3, 0.08), name=name)


def arrow(sh, x1, y1, x2, y2, color=NAVY, width=1.75, head=True):
    c = sh.add_connector(MSO_CONNECTOR.STRAIGHT, Inches(x1), Inches(y1), Inches(x2), Inches(y2))
    style = c._element.find(qn("p:style"))
    if style is not None:
        c._element.remove(style)
    c.line.color.rgb = rgb(color)
    c.line.width = Pt(width)
    if head:
        ln = c.line._get_or_add_ln()
        tail = etree.SubElement(ln, qn("a:tailEnd"))
        tail.set("type", "triangle")
        tail.set("w", "med")
        tail.set("len", "med")
    return c


def blend(c1, c2, n):
    a = [int(c1[i:i + 2], 16) for i in (0, 2, 4)]
    b = [int(c2[i:i + 2], 16) for i in (0, 2, 4)]
    return ["%02X%02X%02X" % tuple(round(a[k] + (b[k] - a[k]) * t / (n - 1)) for k in range(3))
            for t in range(n)]


def pyramid(sh, cx, y_top, total_h, top_w, bot_w, fills, line=None, line_w=1.0, gap=0.06, n=7):
    """Tujuh trapesium bertumpuk: puncak sempit, dasar lebar, sisi miring menerus."""
    tier_h = (total_h - gap * (n - 1)) / n
    tiers = []
    for i in range(n):
        y0 = y_top + i * (tier_h + gap)
        y1 = y0 + tier_h
        wt = top_w + (bot_w - top_w) * (y0 - y_top) / total_h
        wb = top_w + (bot_w - top_w) * (y1 - y_top) / total_h
        shp = box(sh, MSO_SHAPE.TRAPEZOID, cx - wb / 2, y0, wb, tier_h,
                  fill=fills[i], line=line, line_w=line_w, name=f"Tingkat {i + 1}")
        shp.adjustments[0] = ((wb - wt) / 2) / min(wb, tier_h)
        tiers.append({"shape": shp, "y": y0, "h": tier_h, "w_mid": (wt + wb) / 2})
    return tiers


def table(sh, x, y, col_w, row_h, name=None):
    gf = sh.add_table(len(row_h), len(col_w), Inches(x), Inches(y),
                      Inches(sum(col_w)), Inches(sum(row_h)))
    tbl = gf.table
    tbl.first_row = False
    tbl.horz_banding = False
    tbl_pr = tbl._tbl.tblPr
    sid = tbl_pr.find(qn("a:tableStyleId"))
    if sid is None:
        sid = etree.SubElement(tbl_pr, qn("a:tableStyleId"))
    sid.text = "{2D5ABB26-0587-4C30-8999-92F81FD0307C}"   # No Style, No Grid
    for j, w in enumerate(col_w):
        tbl.columns[j].width = Inches(w)
    for i, h in enumerate(row_h):
        tbl.rows[i].height = Inches(h)
    if name:
        gf.name = name
    return tbl


def set_borders(ce, color, sides="B", width=1.0):
    tc_pr = ce._tc.get_or_add_tcPr()
    for tag in ("a:lnL", "a:lnR", "a:lnT", "a:lnB"):
        for e in tc_pr.findall(qn(tag)):
            tc_pr.remove(e)
    for i, (side, tag) in enumerate(zip("LRTB", ("a:lnL", "a:lnR", "a:lnT", "a:lnB"))):
        ln = etree.Element(qn(tag))
        if color and side in sides:
            ln.set("w", str(int(Pt(width))))
            ln.set("cap", "flat")
            ln.set("cmpd", "sng")
            ln.set("algn", "ctr")
            sf = etree.SubElement(ln, qn("a:solidFill"))
            etree.SubElement(sf, qn("a:srgbClr")).set("val", color)
            etree.SubElement(ln, qn("a:prstDash")).set("val", "solid")
        else:
            ln.set("w", "0")
            etree.SubElement(ln, qn("a:noFill"))
        tc_pr.insert(i, ln)


def cell(tbl, r, c, paras, fill=WHITE, anchor="m", margins=(0.14, 0.05, 0.14, 0.05),
         line=CARD_LINE, sides="B"):
    ce = tbl.cell(r, c)
    ce.margin_left, ce.margin_top = Inches(margins[0]), Inches(margins[1])
    ce.margin_right, ce.margin_bottom = Inches(margins[2]), Inches(margins[3])
    ce.vertical_anchor = ANCHOR[anchor]
    ce.text_frame.word_wrap = True
    fill_paras(ce.text_frame, paras)
    if fill:
        ce.fill.solid()
        ce.fill.fore_color.rgb = rgb(fill)
    else:
        ce.fill.background()
    set_borders(ce, line, sides)
    return ce


# --------------------------------------------------------------------------
# Bingkai slide: label bab, judul, footer, nomor slide, catatan
# --------------------------------------------------------------------------
def set_bg(slide, color):
    fill = slide.background.fill
    fill.solid()
    fill.fore_color.rgb = rgb(color)


def kicker(sh, text, dark=False):
    box(sh, MSO_SHAPE.RECTANGLE, M, 0.495, 0.14, 0.14, fill=GOLD if dark else GOLD_DK, name="Penanda bab")
    add_text(sh, M + 0.27, 0.38, 10.5, 0.36,
             [P(text, size=14, bold=True, color=GOLD if dark else GOLD_DK, spc=1.5)],
             anchor="m", name="Label bab")


def set_title(slide, text, dark=False):
    t = slide.shapes.title
    place(t, M, 0.8, CW, 0.78)
    fill_tf(t.text_frame, [P(text, size=34, bold=True, font=HEAD, color=IVORY if dark else NAVY)],
            anchor="t")


def add_slidenum(para, n, size=12, color=NAVY, bold=True):
    """Nomor slide sebagai field: tetap benar bila slide dipindah."""
    fld = etree.Element(qn("a:fld"))
    fld.set("id", "{%s}" % str(uuid.uuid4()).upper())
    fld.set("type", "slidenum")
    r_pr = etree.SubElement(fld, qn("a:rPr"))
    r_pr.set("lang", "id-ID")
    r_pr.set("sz", str(int(size * 100)))
    r_pr.set("b", "1" if bold else "0")
    sf = etree.SubElement(r_pr, qn("a:solidFill"))
    etree.SubElement(sf, qn("a:srgbClr")).set("val", color)
    etree.SubElement(r_pr, qn("a:latin")).set("typeface", BODY)
    etree.SubElement(fld, qn("a:t")).text = str(n)
    end = para._p.find(qn("a:endParaRPr"))
    if end is not None:
        end.addprevious(fld)
    else:
        para._p.append(fld)


def footer(sh, source, n, dark=False):
    if source:
        add_text(sh, M, 6.93, CW - 1.2, 0.3, [P(source, size=11, color=ON_NAVY if dark else SLATE)],
                 anchor="m", name="Footer sumber")
    tb = add_text(sh, SW - M - 1.0, 6.93, 1.0, 0.3, [P(align="r")], anchor="m", name="Nomor slide")
    add_slidenum(tb.text_frame.paragraphs[0], n, color=GOLD if dark else NAVY)


def content_slide(kicker_text, title_text, source, dark=False):
    s = prs.slides.add_slide(L_TITLE_ONLY)
    if dark:
        set_bg(s, NAVY)
    n = len(prs.slides)
    footer(s.shapes, source, n, dark)
    kicker(s.shapes, kicker_text, dark)
    set_title(s, title_text, dark)
    set_notes(s, n)
    return s


def mini_pyramid(sh, cx, y_top, active, label):
    """Piramida kecil penunjuk posisi: tingkat yang sedang dibahas berwarna navy."""
    grp = sh.add_group_shape()
    grp.name = "Posisi dalam Pasal 7"
    fills = [NAVY if (i + 1) in active else NAVY_TINT for i in range(7)]
    tiers = pyramid(grp.shapes, cx, y_top, 3.3, 0.42, 1.72, fills, gap=0.05)
    for i, t in enumerate(tiers):
        if (i + 1) in active:
            fill_tf(t["shape"].text_frame,
                    [P(str(i + 1), size=16, bold=True, font=HEAD, color=GOLD, align="c")], anchor="m")
    add_text(grp.shapes, cx - 1.0, y_top + 3.42, 2.0, 0.4,
             [P(label, size=16, bold=True, color=NAVY, align="c")])
    return grp


# --------------------------------------------------------------------------
# Catatan presenter (2-4 kalimat ucapan + contoh lisan + salah kaprah)
# --------------------------------------------------------------------------
DUR = [30, 45, 30, 60, 50, 45, 45, 60, 50, 50, 75, 60, 45, 45, 50, 50, 60, 50, 45, 50, 90, 45, 0]

NOTES = {
    1: (
        "UCAPKAN: Selamat pagi. Hari ini kita membahas cara peraturan di Indonesia disusun berjenjang "
        "dan mengapa urutan itu menentukan aturan mana yang wajib diikuti. Landasannya UU No. 12 Tahun 2011 "
        "beserta dua perubahannya, yaitu UU No. 15 Tahun 2019 dan UU No. 13 Tahun 2022.\n"
        "CONTOH LISAN: Retribusi parkir di tepi jalan umum di kota Anda diatur dengan peraturan daerah, "
        "bukan dengan undang-undang.\n"
        "SALAH KAPRAH: “Semua aturan resmi sama kuatnya.” Koreksi: kekuatannya ditentukan oleh "
        "tingkatnya dalam hierarki."
    ),
    2: (
        "UCAPKAN: Empat tema ini bergerak dari yang paling dasar ke yang paling praktis: apa itu peraturan, "
        "bagaimana peraturan disusun berjenjang, apa saja jenisnya, lalu bagaimana peraturan dibentuk dan diuji. "
        "Sepanjang sesi, pegang satu pertanyaan: aturan ini berada di tingkat mana?\n"
        "CONTOH LISAN: Ketika muncul aturan baru tentang ojek daring, tanyakan dulu: ini undang-undang, "
        "peraturan menteri, atau peraturan daerah?\n"
        "SALAH KAPRAH: “Hierarki cukup dihafal.” Koreksi: hierarki dipakai untuk memutus benturan aturan, "
        "jadi harus dapat diterapkan pada kasus."
    ),
    3: (
        "UCAPKAN: Kita berjalan dalam empat bab. Bab 1 dan 2 membangun konsep, Bab 3 adalah inti hierarki, "
        "dan Bab 4 menunjukkan cara aturan dibentuk dan diuji, ditutup dengan satu kasus untuk didiskusikan.\n"
        "CONTOH LISAN: Anggap ini peta gedung: kita mulai dari lobi konsep, lalu naik ke lantai hierarki.\n"
        "SALAH KAPRAH: “Implementasi sama dengan sosialisasi.” Koreksi: implementasi mencakup pembentukan "
        "yang sah, partisipasi, dan pengujian ketika aturan bermasalah."
    ),
    4: (
        "UCAPKAN: Kata “peraturan” sehari-hari dipakai untuk apa saja, dari tata tertib kos sampai "
        "undang-undang. Dalam hukum tata negara, yang kita bahas adalah peraturan perundang-undangan, dengan "
        "empat unsur dalam Pasal 1 angka 2: tertulis, berisi norma yang mengikat umum, dibentuk lembaga atau "
        "pejabat berwenang, dan melalui prosedur. Karena mengikat umum, ia harus diundangkan agar setiap orang "
        "mengetahuinya (Pasal 81).\n"
        "CONTOH LISAN: Tata tertib rumah kos tertulis dan ditaati penghuninya, tetapi tidak mengikat orang "
        "di luar kos itu.\n"
        "SALAH KAPRAH: “Perundang-undangan sama dengan undang-undang.” Koreksi: undang-undang hanya "
        "salah satu jenis peraturan perundang-undangan."
    ),
    5: (
        "UCAPKAN: Gunakan tiga ciri ini sebagai daftar periksa. Jika salah satunya tidak terpenuhi, aturan itu "
        "mungkin tetap mengikat, tetapi hanya bagi pihak atau anggota tertentu. Untuk surat edaran, baca isinya "
        "dulu: jika hanya petunjuk internal, ia bukan peraturan perundang-undangan.\n"
        "CONTOH LISAN: Perjanjian sewa kos mengikat Anda dan pemilik kos, tetapi tidak mengikat tetangga Anda.\n"
        "SALAH KAPRAH: “Kontrak berlaku sebagai undang-undang, jadi kontrak adalah undang-undang.” "
        "Koreksi: Pasal 1338 KUHPerdata berarti perjanjian yang sah mengikat para pihak yang membuatnya, "
        "bukan setiap orang."
    ),
    6: (
        "UCAPKAN: Dalam negara hukum, tindakan negara dan warga harus berdasar aturan, sehingga aturan itu "
        "sendiri harus konsisten. Jika satu aturan mewajibkan dan aturan lain melarang hal yang sama, warga "
        "terjepit di antara dua perintah. Hierarki menjawab pertanyaan praktis itu: perintah mana yang berlaku.\n"
        "CONTOH LISAN: Bayangkan undang-undang membolehkan suatu usaha dengan izin, tetapi peraturan daerah "
        "melarangnya sama sekali; pemilik usaha perlu tahu mana yang harus diikuti.\n"
        "SALAH KAPRAH: “Hierarki hanya urutan hafalan untuk ujian.” Koreksi: hierarki adalah alat untuk "
        "memutus konflik norma."
    ),
    7: (
        "UCAPKAN: Kata “tata” berarti susunan: setiap jenis peraturan punya tempat, dan tempat itu "
        "menentukan kekuatannya. Gagasan jenjang norma ini dikenal dari teori Hans Kelsen yang dikembangkan "
        "lebih lanjut oleh Hans Nawiasky. Dalam bahasa sehari-hari: aturan atasan mengalahkan aturan bawahan.\n"
        "CONTOH LISAN: Peraturan pemerintah yang melaksanakan suatu undang-undang tidak boleh menyimpang dari "
        "materi undang-undang itu, misalnya dengan menambah larangan yang tidak dikehendakinya.\n"
        "SALAH KAPRAH: “Aturan bawah boleh menyimpang asal lebih rinci.” Koreksi: lebih rinci boleh, "
        "bertentangan tidak boleh."
    ),
    8: (
        "UCAPKAN: Saat dua aturan berbenturan, periksa tingkatnya lebih dulu; jika berbeda, yang lebih tinggi "
        "menang dan analisis selesai. Hanya jika setingkat, kita bertanya mana yang lebih khusus, lalu mana yang "
        "lebih baru. Urutan pemeriksaan ini sering terbalik dalam jawaban ujian.\n"
        "CONTOH LISAN: Jika dua undang-undang mengatur hal yang sama, undang-undang yang khusus mengatur bidang "
        "itu umumnya didahulukan daripada undang-undang yang umum.\n"
        "SALAH KAPRAH: “Perda lebih baru, jadi Perda menang atas undang-undang.” Koreksi: lex posterior "
        "hanya berlaku di antara aturan yang setingkat."
    ),
    9: (
        "UCAPKAN: Tiga istilah ini menjawab tiga pertanyaan berbeda: bentuknya apa, kekuatannya setinggi apa, "
        "dan isinya boleh apa saja. Sebuah aturan bisa benar bentuknya tetapi salah isinya. Karena itu Pasal 5 "
        "huruf c menuntut kesesuaian antara jenis, hierarki, dan materi muatan.\n"
        "CONTOH LISAN: Pajak dan pungutan lain yang bersifat memaksa harus diatur dengan undang-undang menurut "
        "Pasal 23A UUD 1945, sehingga tidak dapat diadakan hanya dengan peraturan menteri.\n"
        "SALAH KAPRAH: “Asal ditandatangani pejabat berwenang, isinya pasti sah.” Koreksi: pejabat "
        "berwenang pun hanya boleh mengatur materi yang sesuai dengan tingkatnya."
    ),
    10: (
        "UCAPKAN: Pasal 5 adalah daftar periksa cara membentuk aturan, bukan daftar isi aturan. Asas untuk isi "
        "atau materi muatan ada di Pasal 6, yaitu pengayoman, kemanusiaan, kebangsaan, kekeluargaan, "
        "kenusantaraan, bhinneka tunggal ika, keadilan, kesamaan kedudukan dalam hukum dan pemerintahan, "
        "ketertiban dan kepastian hukum, serta keseimbangan, keserasian, dan keselarasan.\n"
        "CONTOH LISAN: Rumusan “dapat dikenai sanksi yang sesuai” tanpa menyebut jenis sanksinya "
        "bermasalah dari sisi kejelasan rumusan.\n"
        "SALAH KAPRAH: “Keterbukaan cukup dengan mengunggah naskah setelah disahkan.” Koreksi: "
        "keterbukaan berlaku sejak perencanaan sampai pengundangan."
    ),
    11: (
        "UCAPKAN: Inilah inti kuliah hari ini: tujuh tingkat menurut Pasal 7 ayat (1), dibaca dari atas ke bawah. "
        "Perhatikan tingkat 3: undang-undang dan Perppu sederajat, dan materi muatan Perppu sama dengan "
        "undang-undang (Pasal 11). Makin ke atas makin kuat; makin ke bawah makin rinci dan makin banyak jumlahnya.\n"
        "CONTOH LISAN: Satu undang-undang dapat dilaksanakan oleh beberapa peraturan pemerintah, dan setiap "
        "daerah dapat membentuk Perda sesuai kebutuhannya.\n"
        "SALAH KAPRAH: “Pancasila ada di puncak piramida.” Koreksi: Pancasila adalah sumber segala "
        "sumber hukum negara (Pasal 2), bukan salah satu tingkat; puncak hierarki adalah UUD 1945, yang menurut "
        "Pasal 3 merupakan hukum dasar."
    ),
    12: (
        "UCAPKAN: Tiga tingkat teratas dibentuk oleh lembaga yang berbeda. UUD hanya dapat diubah oleh MPR "
        "dengan syarat Pasal 37, bukan dengan undang-undang. Perppu adalah jalan darurat Presiden: langsung "
        "berlaku, tetapi harus mendapat persetujuan DPR pada persidangan berikutnya atau dicabut (Pasal 22 "
        "UUD 1945).\n"
        "CONTOH LISAN: Tap yang masih berlaku dan sering dikutip adalah Tap MPRS No. XXV/MPRS/1966, yang "
        "dinyatakan tetap berlaku oleh Tap MPR No. I/MPR/2003.\n"
        "SALAH KAPRAH: “Perppu lebih rendah daripada undang-undang karena dibuat Presiden sendiri.” "
        "Koreksi: Pasal 7 menempatkan keduanya sederajat; bedanya terletak pada keadaan dan prosedur "
        "pembentukannya."
    ),
    13: (
        "UCAPKAN: PP dan Perpres sama-sama ditetapkan Presiden, tetapi fungsinya berbeda. PP selalu berpijak "
        "pada undang-undang yang dijalankannya, sedangkan Perpres dapat lahir dari perintah peraturan yang lebih "
        "tinggi atau dari kekuasaan pemerintahan Presiden.\n"
        "CONTOH LISAN: Susunan organisasi kementerian lazim diatur dengan Perpres, sedangkan Keppres kini lazim "
        "dipakai untuk keputusan konkret, misalnya pengangkatan pejabat.\n"
        "SALAH KAPRAH: “Keppres termasuk hierarki.” Koreksi: itu warisan Tap MPR No. III/MPR/2000; "
        "sejak UU No. 10 Tahun 2004 bentuk yang mengatur adalah Perpres, dan Pasal 7 UU No. 12 Tahun 2011 "
        "tidak memuat Keppres."
    ),
    14: (
        "UCAPKAN: Perda adalah produk bersama: DPRD dan kepala daerah harus sama-sama setuju. Perda mengurus "
        "kebutuhan daerah, termasuk kondisi khusus daerah, tetapi ruangnya dibatasi kewenangan otonomi dan "
        "aturan yang lebih tinggi, termasuk Perda provinsi bagi Perda kabupaten/kota.\n"
        "CONTOH LISAN: Perda tentang rencana tata ruang wilayah, atau tentang pajak dan retribusi daerah, adalah "
        "contoh muatan khas daerah.\n"
        "SALAH KAPRAH: “Kepala daerah dapat membuat Perda sendiri.” Koreksi: yang ditetapkan kepala "
        "daerah sendiri adalah peraturan kepala daerah, seperti Pergub atau Perbup, dan itu bukan Perda."
    ),
    15: (
        "UCAPKAN: Pasal 8 mengakui banyak peraturan lain yang tetap mengikat, tetapi tidak menempatkannya "
        "sebagai tingkat kedelapan. Kekuatannya bergantung pada dua hal: ada perintah dari peraturan yang lebih "
        "tinggi, atau ada kewenangan yang sah. Jika bertentangan dengan undang-undang, peraturan ini dapat diuji "
        "ke Mahkamah Agung.\n"
        "CONTOH LISAN: Undang-undang memerintahkan menteri mengatur tata cara teknis; peraturan menteri itu "
        "mengikat karena perintah tersebut.\n"
        "SALAH KAPRAH: “Permen pasti berada di bawah Perda karena tidak ada di piramida.” Koreksi: "
        "Pasal 8 tidak menyusun urutan antara Permen dan Perda; ukurannya adalah perintah dan kewenangan."
    ),
    16: (
        "UCAPKAN: Tabel ini menjawab pertanyaan “boleh diatur di mana?”. Contoh di kolom kanan sengaja "
        "dibuat umum; untuk tugas, periksa nomor dan teks resminya. Patokan penting: ketentuan pidana hanya "
        "dapat dimuat dalam undang-undang dan Perda (Pasal 15); ketentuan pidana dalam pasal ini telah "
        "disesuaikan oleh UU No. 1 Tahun 2026 tentang Penyesuaian Pidana, tanpa mengubah hierarki.\n"
        "CONTOH LISAN: Peraturan menteri yang mengancam pidana penjara bagi pelanggarnya keluar dari materi "
        "muatan yang boleh ia atur.\n"
        "SALAH KAPRAH: “Perpres boleh mengatur apa saja asal Presiden setuju.” Koreksi: Perpres tetap "
        "dibatasi materi muatan dalam Pasal 13."
    ),
    17: (
        "UCAPKAN: Lima tahap ini adalah definisi pembentukan dalam Pasal 1 angka 1. Rancangan undang-undang pada "
        "umumnya wajib disertai naskah akademik, kecuali beberapa rancangan seperti RUU APBN; di daerah, "
        "Prolegda kini lazim disebut program pembentukan Perda (Propemperda). Pengundangan adalah titik ketika "
        "setiap orang dianggap mengetahui hukum.\n"
        "CONTOH LISAN: RUU yang sudah disetujui bersama tetapi tidak disahkan Presiden dalam 30 hari tetap sah "
        "menjadi undang-undang dan wajib diundangkan (Pasal 20 ayat (5) UUD 1945).\n"
        "SALAH KAPRAH: “Disetujui di rapat paripurna berarti langsung berlaku.” Koreksi: persetujuan "
        "bersama belum sama dengan pengesahan dan pengundangan; daya ikatnya mulai saat diundangkan, kecuali "
        "ditentukan lain (Pasal 87)."
    ),
    18: (
        "UCAPKAN: Partisipasi bermakna menjadi sorotan setelah Mahkamah Konstitusi memeriksa pembentukan "
        "UU Cipta Kerja dalam Putusan Nomor 91/PUU-XVIII/2020. UU No. 13 Tahun 2022 kemudian memperkuat "
        "Pasal 96: masyarakat berhak memberi masukan dalam setiap tahap, bukan hanya di akhir. Ukurannya bukan "
        "jumlah acara, tetapi apakah masukan didengar, dipertimbangkan, dan dijelaskan hasilnya.\n"
        "CONTOH LISAN: Pedagang pasar yang terdampak rancangan Perda retribusi dapat menyampaikan masukan "
        "tertulis atau mengikuti konsultasi publik secara daring.\n"
        "SALAH KAPRAH: “Sosialisasi setelah rancangan final sudah cukup.” Koreksi: sosialisasi satu arah "
        "bukan partisipasi bermakna."
    ),
    19: (
        "UCAPKAN: Metode omnibus mendapat dasar hukum dalam UU No. 13 Tahun 2022, setelah Putusan MK Nomor "
        "91/PUU-XVIII/2020 tentang pengujian formil UU Cipta Kerja. Omnibus adalah teknik penyusunan, bukan jenis "
        "peraturan baru, sehingga hasilnya tetap berada pada tingkat yang sama dengan peraturan yang diubah atau "
        "digabungkan.\n"
        "CONTOH LISAN: Beberapa undang-undang yang sama-sama mengatur perizinan dapat diubah sekaligus dalam "
        "satu undang-undang.\n"
        "SALAH KAPRAH: “Omnibus berarti satu undang-undang dapat sekaligus mengubah PP dan Perda.” "
        "Koreksi: yang diubah, dicabut, atau digabungkan harus sama jenis dan hierarkinya."
    ),
    20: (
        "UCAPKAN: Jalur pengujian mengikuti hierarki: undang-undang diuji ke Mahkamah Konstitusi, sedangkan "
        "peraturan di bawah undang-undang diuji ke Mahkamah Agung. Pemohonnya adalah pihak yang hak atau "
        "kewenangannya dirugikan oleh aturan itu. Akibatnya bergantung pada amar putusan; dalam perkara UU Cipta "
        "Kerja, misalnya, MK menyatakannya inkonstitusional bersyarat, bukan langsung batal.\n"
        "CONTOH LISAN: Peraturan menteri yang dianggap bertentangan dengan undang-undang diajukan ke Mahkamah "
        "Agung, bukan ke Mahkamah Konstitusi.\n"
        "SALAH KAPRAH: “Semua peraturan diuji di MK.” Koreksi: MK menguji undang-undang terhadap "
        "UUD 1945; peraturan di bawahnya diuji di MA."
    ),
    21: (
        "UCAPKAN: Beri waktu satu menit untuk diskusi berpasangan, lalu minta tiga orang menjawab satu "
        "pertanyaan masing-masing. Tegaskan bahwa kasus ini fiktif.\n"
        "JAWABAN (sampaikan setelah diskusi):\n"
        "(1) Undang-undang menang: UU berada di tingkat 3, sedangkan Perda Kabupaten/Kota di tingkat 7.\n"
        "(2) Asas lex superior derogat legi inferiori. Perda tidak dapat berlindung pada lex specialis atau "
        "lex posterior, karena keduanya hanya berlaku antaraturan yang setingkat.\n"
        "(3) Uji materiil ke Mahkamah Agung, karena Perda adalah peraturan di bawah undang-undang (Pasal 9 "
        "ayat (2) UU No. 12 Tahun 2011). Sejak Putusan MK No. 137/PUU-XIII/2015 dan No. 56/PUU-XIV/2016, "
        "Menteri Dalam Negeri dan gubernur tidak lagi dapat membatalkan Perda.\n"
        "CONTOH LISAN: Bandingkan bila yang bertentangan adalah dua Perda dari kabupaten yang sama; barulah "
        "asas khusus atau asas baru relevan.\n"
        "SALAH KAPRAH: “Perda pasti menang karena lebih khusus untuk daerahnya.” Koreksi: kekhususan "
        "tidak mengalahkan aturan yang lebih tinggi."
    ),
    22: (
        "UCAPKAN: Jika hanya satu hal yang Anda bawa pulang: setiap kali membaca aturan, tanyakan bentuknya, "
        "tingkatnya, dan siapa pembentuknya. Untuk tugas dan rujukan, selalu periksa teks resmi beserta "
        "perubahannya, karena banyak peraturan sudah diubah lebih dari sekali.\n"
        "CONTOH LISAN: Saat mengutip UU No. 12 Tahun 2011, sebutkan juga undang-undang yang mengubahnya.\n"
        "SALAH KAPRAH: “Teks dari blog atau media sosial cukup untuk rujukan.” Koreksi: rujukan hukum "
        "harus diambil dari teks resmi."
    ),
    23: (
        "UCAPKAN: Buka sesi tanya jawab. Jika hening, ajukan pertanyaan pemantik di layar.\n"
        "JAWABAN PEMANTIK: Peraturan menteri tidak termasuk tujuh tingkat Pasal 7; ia diakui dan mengikat "
        "menurut Pasal 8 sepanjang diperintahkan peraturan yang lebih tinggi atau dibentuk berdasarkan "
        "kewenangan.\n"
        "CONTOH LISAN: Jika ditanya mengapa Tap MPR masuk hierarki, jelaskan bahwa yang dimaksud hanya Tap yang "
        "masih berlaku menurut Tap MPR No. I/MPR/2003.\n"
        "SALAH KAPRAH: “Tap MPR selalu ada dalam hierarki.” Koreksi: UU No. 10 Tahun 2004 tidak "
        "mencantumkannya; UU No. 12 Tahun 2011 memasukkannya kembali."
    ),
}


def fmt(sec):
    return f"{sec // 60}:{sec % 60:02d}"


def set_notes(slide, n):
    start, dur = sum(DUR[:n - 1]), DUR[n - 1]
    if dur:
        head = f"WAKTU {fmt(start)}–{fmt(start + dur)} (±{dur} detik)"
    else:
        head = f"WAKTU {fmt(start)} dan seterusnya: tanya jawab, di luar durasi paparan"
    tf = slide.notes_slide.notes_text_frame
    tf.text = head + "\n" + NOTES[n]
    for p in tf.paragraphs:
        for r in p.runs:
            r._r.get_or_add_rPr().set("lang", "id-ID")


# --------------------------------------------------------------------------
# Presentasi, tema, master
# --------------------------------------------------------------------------
prs = Presentation()
prs.slide_width, prs.slide_height = 12192000, 6858000     # 13,333 x 7,5 inci


def setup_theme_and_master():
    master = prs.slide_master
    theme_part = master.part.part_related_by(RT.THEME)
    a_ns = "http://schemas.openxmlformats.org/drawingml/2006/main"
    ns = {"a": a_ns}
    root = etree.fromstring(theme_part.blob)
    root.set("name", "Tata Perundang-undangan")
    clr = root.find(".//a:clrScheme", ns)
    clr.set("name", "Perundang-undangan")
    scheme = {"dk1": INK, "lt1": WHITE, "dk2": NAVY, "lt2": IVORY, "accent1": NAVY,
              "accent2": GOLD, "accent3": MAROON, "accent4": GOLD_DK, "accent5": SLATE,
              "accent6": NAVY_LOW, "hlink": NAVY, "folHlink": MAROON}
    for tag, val in scheme.items():
        el = clr.find(f"a:{tag}", ns)
        for child in list(el):
            el.remove(child)
        etree.SubElement(el, f"{{{a_ns}}}srgbClr").set("val", val)
    fonts = root.find(".//a:fontScheme", ns)
    fonts.set("name", "Perundang-undangan")
    fonts.find("a:majorFont/a:latin", ns).set("typeface", HEAD)
    fonts.find("a:minorFont/a:latin", ns).set("typeface", BODY)
    theme_part._blob = etree.tostring(root, xml_declaration=True, encoding="UTF-8", standalone=True)

    # Templat bawaan 4:3; rentangkan bentuk master/layout ke lebar 16:9.
    scale = 12192000 / 9144000
    for container in [master] + list(prs.slide_layouts):
        for shp in container.shapes:
            sp_pr = shp._element.find(qn("p:spPr"))
            if sp_pr is not None and sp_pr.find(qn("a:xfrm")) is not None:
                shp.left = int(shp.left * scale)
                shp.width = int(shp.width * scale)

    master.background.fill.solid()
    master.background.fill.fore_color.rgb = rgb(IVORY)

    # Gaya judul master: serif tebal, navy, rata kiri.
    tx = master._element.find(qn("p:txStyles"))
    lvl1 = tx.find(qn("p:titleStyle")).find(qn("a:lvl1pPr"))
    lvl1.set("algn", "l")
    d = lvl1.find(qn("a:defRPr"))
    d.set("sz", "3400")
    d.set("b", "1")
    for sf in d.findall(qn("a:solidFill")):
        for child in list(sf):
            sf.remove(child)
        etree.SubElement(sf, qn("a:schemeClr")).set("val", "tx2")
    for ph in list(master.placeholders) + list(L_TITLE_ONLY.placeholders):
        if ph.placeholder_format.type == PP_PLACEHOLDER.TITLE:
            place(ph, M, 0.8, CW, 0.78)
            tf = ph.text_frame
            tf.margin_left = tf.margin_right = tf.margin_top = tf.margin_bottom = 0
            tf.vertical_anchor = MSO_ANCHOR.TOP

    cp = prs.core_properties
    cp.title = "Tata Perundang-undangan Indonesia"
    cp.subject = "Pengertian, Jenis, Hierarki, dan Implementasinya"
    cp.author = "Penyaji"
    cp.last_modified_by = "Penyaji"
    cp.keywords = "UU 12/2011; UU 13/2022; hierarki; Pasal 7; Pasal 8"
    cp.language = "id-ID"
    cp.revision = 1


L_TITLE = prs.slide_layouts[0]       # Title Slide
L_TITLE_ONLY = prs.slide_layouts[5]  # Title Only
setup_theme_and_master()


def deco_pyramid(sh, cx):
    """Piramida garis emas untuk sampul dan penutup (dekoratif)."""
    grp = sh.add_group_shape()
    grp.name = "Piramida tujuh tingkat (dekoratif)"
    tiers = pyramid(grp.shapes, cx, 1.3, 4.95, 0.5, 3.0, [GOLD] + [None] * 6,
                    line=GOLD, line_w=1.25, gap=0.07)
    for i, t in enumerate(tiers):
        fill_tf(t["shape"].text_frame,
                [P(str(i + 1), size=16, bold=True, font=HEAD, color=NAVY if i == 0 else GOLD, align="c")],
                anchor="m")
    return grp


# ==========================================================================
# SLIDE
# ==========================================================================
def s01_sampul():
    s = prs.slides.add_slide(L_TITLE)
    set_bg(s, NAVY)
    t = s.shapes.title
    place(t, 0.8, 1.3, 8.7, 2.15)
    fill_tf(t.text_frame, [P("Tata Perundang-undangan", size=46, bold=True, font=HEAD, color=IVORY, line=0.95),
                           P("Indonesia", size=46, bold=True, font=HEAD, color=IVORY, line=0.95)], anchor="b")
    sub = s.placeholders[1]
    place(sub, 0.8, 3.6, 8.7, 0.55)
    fill_tf(sub.text_frame, [P("Pengertian, Jenis, Hierarki, dan Implementasinya", size=22, color=GOLD)])
    add_text(s.shapes, 0.8, 4.22, 8.7, 0.45,
             [P("Berdasarkan UU No. 12 Tahun 2011 jo. UU No. 13 Tahun 2022", size=18, color=ON_NAVY)],
             name="Landasan")
    add_text(s.shapes, 0.8, 5.45, 3.9, 0.95,
             [P("PENYAJI", size=16, bold=True, color=GOLD, spc=1.2, after=4),
              P("[Nama Penyaji]", size=20, color=IVORY)], name="Penyaji")
    add_text(s.shapes, 4.9, 5.45, 4.6, 0.95,
             [P("MATA KULIAH", size=16, bold=True, color=GOLD, spc=1.2, after=4),
              P("[Nama Mata Kuliah]", size=20, color=IVORY)], name="Mata kuliah")
    deco_pyramid(s.shapes, 11.2)
    set_notes(s, 1)


def s02_tujuan():
    s = content_slide("PENDAHULUAN", "Apa yang akan kita pahami", SRC_UMUM)
    items = [("Peraturan",), ("Pengertian tata", "perundang-undangan"), ("Jenis dan tata urutan",),
             ("Implementasi",)]
    for i, lines in enumerate(items):
        y = 1.9 + i * 1.17
        card(s.shapes, M, y, 6.9, 1.0, name=f"Tema {i + 1}")
        badge(s.shapes, M + 0.55, y + 0.5, 0.62, str(i + 1))
        add_text(s.shapes, M + 1.15, y, 5.55, 1.0,
                 [P(t, size=24, bold=True, font=HEAD, color=NAVY, line=0.92) for t in lines], anchor="m")
    box(s.shapes, ROUND, 7.85, 1.9, SW - M - 7.85, 4.51, fill=NAVY, radius=0.1,
        paras=[P("JANJI SESI", size=16, bold=True, color=GOLD, spc=1.2, after=14),
               P("Di akhir sesi, Anda dapat menempatkan suatu aturan pada tingkat yang benar",
                 size=24, font=HEAD, color=IVORY, after=10),
               P("dan tahu apa yang terjadi jika ia bertentangan.", size=24, font=HEAD, color=GOLD)],
        anchor="m", margins=(0.45, 0.3, 0.45, 0.3), name="Janji sesi")


def s03_peta():
    s = content_slide("PENDAHULUAN", "Peta presentasi", SRC_UMUM, dark=True)
    chapters = [("Peraturan", "Slide 4–6"),
                ("Pengertian Tata Perundang-undangan", "Slide 7–10"),
                ("Jenis dan Tata Urutan", "Slide 11–16"),
                ("Implementasi", "Slide 17–21")]
    col = CW / 4
    cxs = [M + col / 2 + i * col for i in range(4)]
    cy = 3.15
    arrow(s.shapes, cxs[0], cy, cxs[-1], cy, color=GOLD, width=2.0, head=False)
    for i, (name, rng) in enumerate(chapters):
        cx = cxs[i]
        add_text(s.shapes, cx - 0.7, cy - 1.12, 1.4, 0.36,
                 [P("BAB", size=16, bold=True, color=ON_NAVY, spc=2, align="c")], anchor="m")
        box(s.shapes, MSO_SHAPE.OVAL, cx - 0.62, cy - 0.62, 1.24, 1.24, fill=NAVY, line=GOLD, line_w=2.5,
            paras=[P(str(i + 1), size=40, bold=True, font=HEAD, color=GOLD, align="c")],
            anchor="m", margins=(0, 0, 0, 0), name=f"Bab {i + 1}")
        add_text(s.shapes, cx - col / 2 + 0.08, 4.05, col - 0.16, 1.0,
                 [P(name, size=20, bold=True, color=IVORY, align="c")], name=f"Judul bab {i + 1}")
        add_text(s.shapes, cx - col / 2 + 0.08, 5.1, col - 0.16, 0.4,
                 [P(rng, size=16, color=GOLD, align="c")])


def s04_apa_itu_peraturan():
    s = content_slide(K1, "Apa itu peraturan", "Sumber: Pasal 1 angka 2 dan Pasal 81 UU No. 12 Tahun 2011")
    add_text(s.shapes, M, 1.72, CW, 0.45,
             [P("Peraturan adalah aturan tertulis yang mengikat—tetapi tiga istilah ini berbeda.", size=20)])
    for k, (term, meaning) in enumerate([
            ("Peraturan", "Aturan yang dibuat oleh penguasa yang berwenang."),
            ("Perundang-undangan", "Keseluruhan proses dan hasil pembentukan hukum tertulis.")]):
        card(s.shapes, M, 2.35 + k * 1.85, 4.75, 1.65,
             paras=[P(term, size=22, bold=True, font=HEAD, color=NAVY, after=6), P(meaning, size=18)],
             anchor="m", margins=(0.3, 0.15, 0.3, 0.15), name=f"Istilah {term}")
    g = dict(bold=True, color=GOLD)
    box(s.shapes, ROUND, 5.6, 2.35, SW - M - 5.6, 3.5, fill=NAVY, radius=0.1,
        paras=[P("Peraturan perundang-undangan", size=24, bold=True, font=HEAD, color=GOLD, after=2),
               P("Pasal 1 angka 2 UU No. 12 Tahun 2011", size=16, color=ON_NAVY, after=12),
               P("Peraturan ", R("tertulis", **g), " yang memuat norma hukum yang ",
                 R("mengikat secara umum", **g), size=20, color=IVORY, after=6),
               P("dan dibentuk atau ditetapkan oleh ", R("lembaga negara atau pejabat yang berwenang", **g),
                 size=20, color=IVORY, after=6),
               P("melalui ", R("prosedur", **g), " yang ditetapkan dalam Peraturan Perundang-undangan.",
                 size=20, color=IVORY)],
        anchor="m", margins=(0.4, 0.25, 0.4, 0.25), name="Definisi Pasal 1 angka 2")
    callout(s.shapes, M, 6.05, CW, 0.6, "Akibat hukum: ",
            "mengikat setiap orang dan wajib diundangkan agar diketahui umum.")


def s05_ciri_pembeda():
    s = content_slide(K1, "Tiga ciri pembeda", "Sumber: Pasal 1 angka 2 UU No. 12 Tahun 2011")
    add_text(s.shapes, M, 1.7, CW, 0.5,
             [P("Bukan setiap aturan adalah peraturan perundang-undangan.", size=22, italic=True, font=HEAD,
                color=NAVY)])
    w3 = (CW - 2 * 0.3) / 3
    crit = ["Dibuat lembaga atau pejabat yang berwenang",
            "Melalui prosedur pembentukan yang ditentukan",
            "Memuat norma yang mengikat umum"]
    for i, c in enumerate(crit):
        x = M + i * (w3 + 0.3)
        card(s.shapes, x, 2.4, w3, 1.35, name=f"Ciri {i + 1}")
        badge(s.shapes, x + 0.5, 2.4 + 0.675, 0.6, str(i + 1))
        add_text(s.shapes, x + 0.95, 2.4, w3 - 1.15, 1.35, [P(c, size=18, bold=True, color=NAVY)], anchor="m")
    add_text(s.shapes, M, 4.05, 2.6, 0.75, [P("Contoh yang bukan:", size=18, bold=True)], anchor="m")
    chips = ["AD/ART perkumpulan", "Kontrak atau perjanjian", "Surat edaran berisi petunjuk internal"]
    chip_w = (CW - 2.7 - 2 * 0.25) / 3
    for i, c in enumerate(chips):
        card(s.shapes, M + 2.7 + i * (chip_w + 0.25), 4.05, chip_w, 0.75, line=SLATE, radius=0.375,
             paras=[P(c, size=17, align="c")], anchor="m", margins=(0.18, 0.04, 0.18, 0.04),
             name=f"Bukan PUU {i + 1}")
    callout(s.shapes, M, 5.05, CW, 0.6, "Akibat hukum: ",
            "hanya mengikat pihak atau anggotanya, bukan setiap orang.")
    add_text(s.shapes, M, 5.85, CW, 0.45,
             [P("Status surat edaran bergantung pada isinya; jangan disamaratakan.", size=17, italic=True)])


def s06_mengapa_ditata():
    s = content_slide(K1, "Mengapa peraturan harus ditata",
                      "Sumber: Pasal 1 ayat (3) UUD NRI Tahun 1945; Pasal 7 ayat (2) UU No. 12 Tahun 2011")
    box(s.shapes, ROUND, M, 1.9, 5.2, 3.0, fill=NAVY, radius=0.1,
        paras=[P("“Negara Indonesia adalah negara hukum.”", size=28, font=HEAD, color=IVORY, after=12),
               P("Pasal 1 ayat (3) UUD NRI Tahun 1945", size=16, color=GOLD)],
        anchor="m", margins=(0.4, 0.3, 0.4, 0.3), name="Kutipan Pasal 1 ayat (3)")
    bw = 2.75
    xa, xb = 6.2, SW - M - bw
    for x, head, sub in [(xa, "Aturan A", "mewajibkan"), (xb, "Aturan B", "melarang")]:
        card(s.shapes, x, 1.9, bw, 1.3, line=NAVY, line_w=1.5,
             paras=[P(head, size=20, bold=True, font=HEAD, color=NAVY, align="c", after=2),
                    P(sub, size=18, align="c")], anchor="m", name=head)
    mx = (xa + bw + xb) / 2
    badge(s.shapes, mx, 2.55, 0.72, "≠", fill=MAROON, color=WHITE, size=30, font=BODY,
          name="Tanda bertentangan")
    box(s.shapes, MSO_SHAPE.DOWN_ARROW, mx - 0.22, 3.32, 0.44, 0.38, fill=MAROON, name="Panah konflik")
    card(s.shapes, xa, 3.8, SW - M - xa, 1.1, line=MAROON, line_w=1.5,
         paras=[P(R("Tanpa tata urutan: ", bold=True, color=MAROON),
                  R("warga tidak tahu aturan mana yang wajib diikuti."), size=18)],
         anchor="m", margins=(0.3, 0.08, 0.3, 0.08), name="Akibat tanpa tata urutan")
    box(s.shapes, ROUND, M, 5.25, CW, 1.1, fill=GOLD_TINT,
        paras=[P("Hierarki memberi kepastian, bukan sekadar daftar.", size=28, bold=True, font=HEAD,
                 color=NAVY)], anchor="m", margins=(0.4, 0.1, 0.4, 0.1), name="Pesan utama")


def s07_arti_tata():
    s = content_slide(K2, "Apa arti tata perundang-undangan",
                      "Sumber: Pasal 7 ayat (2) UU No. 12 Tahun 2011 dan penjelasannya")
    add_text(s.shapes, M, 1.72, CW, 0.45,
             [P(R("Tata perundang-undangan: ", bold=True, color=NAVY),
                R("susunan berjenjang jenis peraturan menurut kekuatan hukumnya."), size=20)])
    box(s.shapes, ROUND, M, 2.45, 6.0, 0.85, fill=NAVY,
        paras=[P("Aturan yang lebih tinggi", size=20, bold=True, color=IVORY, align="c")],
        anchor="m", name="Aturan lebih tinggi")
    card(s.shapes, M, 5.0, 6.0, 0.85, line=NAVY, line_w=1.5,
         paras=[P("Aturan yang lebih rendah", size=20, bold=True, color=NAVY, align="c")],
         anchor="m", name="Aturan lebih rendah")
    rel = [("bersumber pada", NAVY, GOLD_DK), ("melaksanakan", NAVY, GOLD_DK),
           ("tidak boleh bertentangan", MAROON, MAROON)]
    colw = (6.0 - 2 * 0.15) / 3
    for i, (label, txt_color, arrow_color) in enumerate(rel):
        x = M + i * (colw + 0.15)
        box(s.shapes, MSO_SHAPE.UP_ARROW, x + colw / 2 - 0.2, 3.42, 0.4, 0.55, fill=arrow_color,
            name=f"Relasi {i + 1}")
        add_text(s.shapes, x, 4.05, colw, 0.85,
                 [P(label, size=17, bold=True, color=txt_color, align="c")], name=f"Label relasi {i + 1}")
    card(s.shapes, 7.0, 2.45, SW - M - 7.0, 3.4,
         paras=[P("ASAS", size=16, bold=True, color=GOLD_DK, spc=1.2, after=8),
                P("Lex superior derogat legi inferiori", size=26, italic=True, font=HEAD, color=NAVY, after=12),
                P("Aturan yang lebih tinggi mengalahkan aturan yang lebih rendah.", size=20)],
         anchor="m", margins=(0.4, 0.25, 0.4, 0.25), name="Asas lex superior")
    callout(s.shapes, M, 6.05, CW, 0.6, "Akibat hukum: ",
            "bila bertentangan, aturan yang lebih rendah dapat diuji dan dibatalkan.")


def s08_tiga_asas():
    s = content_slide(K2, "Tiga asas jika aturan bentrok",
                      "Sumber: Pasal 7 ayat (2) UU No. 12 Tahun 2011; asas penafsiran dalam doktrin ilmu hukum")
    tbl = table(s.shapes, M, 1.9, [0.95, 4.35, 3.3, CW - 0.95 - 4.35 - 3.3], [0.55, 0.9, 0.9, 0.9],
                name="Tabel tiga asas")
    for j, h in enumerate(["Urutan", "Asas", "Dalam bahasa sederhana", "Dipakai jika"]):
        cell(tbl, 0, j, [P(h, size=16, bold=True, color=GOLD, align="c" if j == 0 else "l")],
             fill=NAVY, line=None, margins=(0.06 if j == 0 else 0.14, 0.05, 0.06 if j == 0 else 0.14, 0.05))
    data = [("1", "Lex superior derogat legi inferiori", "Yang lebih tinggi menang", "Tingkatnya berbeda"),
            ("2", "Lex specialis derogat legi generali", "Yang lebih khusus menang", "Setingkat"),
            ("3", "Lex posterior derogat legi priori", "Yang lebih baru menang",
             "Setingkat, dan sama-sama khusus atau sama-sama umum")]
    for i, (n, lat, plain, cond) in enumerate(data, start=1):
        cell(tbl, i, 0, [P(n, size=28, bold=True, font=HEAD, color=NAVY, align="c")])
        cell(tbl, i, 1, [P(lat, size=21, italic=True, font=HEAD, color=NAVY)])
        cell(tbl, i, 2, [P(plain, size=19, bold=True)], margins=(0.12, 0.05, 0.12, 0.05))
        cell(tbl, i, 3, [P(cond, size=18)])
    warn(s.shapes, M, 5.6, CW, 0.8,
         [P("Asas khusus dan asas baru tidak dapat mengalahkan aturan yang lebih tinggi.",
            size=20, bold=True, color=WHITE)])


def s09_tiga_hal():
    s = content_slide(K2, "Tiga hal yang sering dicampur",
                      "Sumber: Pasal 5 huruf c, Pasal 7, dan Pasal 10–15 UU No. 12 Tahun 2011")
    w = (CW - 2.2) / 3
    tbl = table(s.shapes, M, 1.9, [2.2, w, w, w], [0.75, 1.05, 1.05], name="Tabel jenis, hierarki, materi muatan")
    cell(tbl, 0, 0, [], fill=NAVY, line=None)
    for j, h in enumerate(["Jenis", "Hierarki", "Materi muatan"], start=1):
        cell(tbl, 0, j, [P(h, size=24, bold=True, font=HEAD, color=GOLD)], fill=NAVY, line=None)
    body = [("Artinya", ["Nama bentuk peraturan", "Tingkat kekuatan hukumnya",
                         "Isi yang boleh diatur pada tingkat itu"]),
            ("Contoh", ["UU, PP, Perda", "UU berada di atas PP",
                        "Ketentuan pidana hanya dalam UU dan Perda"])]
    for i, (lab, vals) in enumerate(body, start=1):
        cell(tbl, i, 0, [P(lab, size=18, bold=True, color=NAVY)], fill=GOLD_TINT)
        for j, v in enumerate(vals, start=1):
            cell(tbl, i, j, [P(v, size=19)])
    warn(s.shapes, M, 4.95, CW, 1.3,
         [P(R("Kesalahan klasik: ", bold=True), "materi undang-undang dimuat dalam peraturan menteri.",
            size=20, color=WHITE, after=6),
          P("Akibatnya: rentan dibatalkan melalui uji materiil di Mahkamah Agung.", size=18, color=WHITE)],
         name="Kesalahan klasik")


def s10_asas_pembentukan():
    s = content_slide(K2, "Asas pembentukan yang baik", "Sumber: Pasal 5 UU No. 12 Tahun 2011 dan penjelasannya")
    asas = [("a", "Kejelasan tujuan", "Tujuannya jelas sejak awal"),
            ("b", "Kelembagaan atau pejabat pembentuk yang tepat", "Dibuat oleh yang berwenang"),
            ("c", "Kesesuaian antara jenis, hierarki, dan materi muatan", "Bentuk sesuai dengan isi"),
            ("d", "Dapat dilaksanakan", "Efektif di lapangan"),
            ("e", "Kedayagunaan dan kehasilgunaan", "Dibutuhkan dan bermanfaat"),
            ("f", "Kejelasan rumusan", "Tidak menimbulkan multitafsir"),
            ("g", "Keterbukaan", "Terbuka di setiap tahap")]
    cw2 = (CW - 0.35) / 2
    rh, gap = 1.05, 0.13
    for k in range(8):
        col, row = divmod(k, 4)
        x, y = M + col * (cw2 + 0.35), 1.85 + row * (rh + gap)
        if k < 7:
            letter, name, expl = asas[k]
            card(s.shapes, x, y, cw2, rh, name=f"Asas {letter}")
            badge(s.shapes, x + 0.45, y + rh / 2, 0.52, letter, size=20)
            add_text(s.shapes, x + 0.88, y, cw2 - 1.05, rh,
                     [P(name, size=18, bold=True, font=HEAD, color=NAVY, after=2), P(expl, size=16)],
                     anchor="m")
        else:
            box(s.shapes, ROUND, x, y, cw2, rh, fill=GOLD_TINT,
                paras=[P(R("Akibat hukum: ", bold=True, color=NAVY),
                         "pelanggaran asas, misalnya keterbukaan, dapat menjadi alasan pengujian.", size=17)],
                anchor="m", margins=(0.3, 0.06, 0.3, 0.06), name="Akibat hukum")


def s11_piramida():
    s = content_slide(K3, "Tujuh tingkat hierarki", "Sumber: Pasal 7 ayat (1) dan ayat (2) UU No. 12 Tahun 2011")
    labels = ["UUD NRI Tahun 1945", "Ketetapan MPR", "Undang-Undang / Perppu", "Peraturan Pemerintah",
              "Peraturan Presiden", "Peraturan Daerah Provinsi", "Peraturan Daerah Kabupaten/Kota"]
    grp = s.shapes.add_group_shape()
    grp.name = "Piramida hierarki Pasal 7 ayat (1)"
    cx = 4.7
    tiers = pyramid(grp.shapes, cx, 1.85, 4.75, 2.85, 6.6, blend(NAVY, NAVY_LOW, 7), gap=0.06)
    for i, t in enumerate(tiers):
        fill_tf(t["shape"].text_frame, [P(labels[i], size=20, bold=True, color=IVORY, align="c")], anchor="m")
        t["shape"]._element.nvSpPr.cNvPr.set("descr", f"Tingkat {i + 1}: {labels[i]}")
        badge(grp.shapes, cx - t["w_mid"] / 2 - 0.44, t["y"] + t["h"] / 2, 0.6, str(i + 1),
              fill=GOLD, color=NAVY, size=26, name=f"Angka tingkat {i + 1}")
    px = 8.4
    q = dict(size=20, font=HEAD, color=NAVY, line=1.05)
    card(s.shapes, px, 1.85, SW - M - px, 3.0,
         paras=[P("PASAL 7 AYAT (2)", size=16, bold=True, color=GOLD_DK, spc=1.2, after=10),
                P("“Kekuatan hukum", **q), P("Peraturan Perundang-undangan", **q),
                P("sesuai dengan hierarki…”", **q)],
         anchor="m", margins=(0.3, 0.2, 0.3, 0.2), name="Pasal 7 ayat (2)")
    box(s.shapes, MSO_SHAPE.UP_ARROW, px + 0.1, 5.1, 0.5, 1.5, fill=GOLD_DK, name="Arah kekuatan hukum")
    add_text(s.shapes, px + 0.8, 5.05, 3.0, 0.4, [P("lebih kuat", size=18, bold=True, color=NAVY)])
    add_text(s.shapes, px + 0.8, 6.2, 3.0, 0.4, [P("lebih rinci", size=18)], anchor="b")


def s12_tingkat_1_3():
    s = content_slide(K3, "Tingkat 1–3: siapa membuat, untuk apa",
                      "Sumber: Pasal 3 dan Pasal 7 (beserta penjelasan) UU No. 12 Tahun 2011; "
                      "Pasal 22 dan Pasal 37 UUD NRI 1945")
    b = dict(bold=True)
    rows = [("1", "UUD NRI 1945",
             [P("Hukum dasar dalam peraturan perundang-undangan (Pasal 3)."),
              P("Diubah MPR melalui prosedur Pasal 37 UUD, bukan dengan undang-undang.")], 1.28),
            ("2", "Ketetapan MPR",
             [P("Hanya Tap yang dinyatakan masih berlaku oleh Tap MPR No. I/MPR/2003."),
              P("Bukan produk baru yang dapat dibuat sewaktu-waktu seperti dahulu.")], 1.45),
            ("3", "UU / Perppu",
             [P(R("UU: ", **b), "dibentuk DPR dengan persetujuan bersama Presiden."),
              P(R("Perppu: ", **b), "ditetapkan Presiden dalam hal ihwal kegentingan yang memaksa."),
              P("Wajib diajukan ke DPR pada persidangan berikut: disetujui menjadi UU atau dicabut.")], 1.75)]
    y = 1.85
    rw = 9.85
    for n, label, paras, h in rows:
        card(s.shapes, M, y, rw, h, name=f"Tingkat {n}")
        badge(s.shapes, M + 0.5, y + h / 2, 0.62, n, fill=GOLD, color=NAVY, size=24)
        add_text(s.shapes, M + 1.0, y, 2.3, h, [P(label, size=22, bold=True, font=HEAD, color=NAVY)], anchor="m")
        for p in paras:
            p["after"] = 4
            for _, st in p["runs"]:
                st.setdefault("size", 17)
        add_text(s.shapes, M + 3.35, y, rw - 3.55, h, paras, anchor="m")
        y += h + 0.12
    mini_pyramid(s.shapes, 11.85, 1.95, {1, 2, 3}, "Tingkat 1–3")


def s13_tingkat_4_5():
    s = content_slide(K3, "Tingkat 4–5: PP dan Perpres",
                      "Sumber: Pasal 1 angka 5–6, Pasal 7, Pasal 12–13 UU No. 12 Tahun 2011; "
                      "Pasal 5 ayat (2) UUD NRI 1945")
    b = dict(bold=True)
    cards_ = [("4", "Peraturan Pemerintah",
               [P(R("Ditetapkan oleh: ", **b), "Presiden", size=18, after=6),
                P("Untuk menjalankan undang-undang sebagaimana mestinya.", size=18, after=6),
                P("Tidak ada PP tanpa undang-undang yang dijalankannya.", size=18, italic=True, color=NAVY)]),
              ("5", "Peraturan Presiden",
               [P(R("Ditetapkan oleh: ", **b), "Presiden", size=18, after=6),
                P("Untuk menjalankan perintah peraturan yang lebih tinggi,", size=18, after=2),
                P("atau dalam menyelenggarakan kekuasaan pemerintahan.", size=18)])]
    cw2 = (9.85 - 0.25) / 2
    for k, (n, head, paras) in enumerate(cards_):
        x = M + k * (cw2 + 0.25)
        card(s.shapes, x, 1.85, cw2, 3.0, name=head)
        badge(s.shapes, x + 0.55, 1.85 + 0.55, 0.62, n, fill=GOLD, color=NAVY, size=24)
        add_text(s.shapes, x + 1.05, 1.85 + 0.2, cw2 - 1.2, 0.7,
                 [P(head, size=22, bold=True, font=HEAD, color=NAVY)], anchor="m")
        add_text(s.shapes, x + 0.3, 1.85 + 1.05, cw2 - 0.55, 1.85, paras)
    warn(s.shapes, M, 5.1, 9.85, 1.35,
         [P("Perpres bukan pengganti undang-undang.", size=20, bold=True, color=WHITE, after=6),
          P("Keputusan Presiden (Keppres) bukan salah satu tingkat dalam Pasal 7.", size=18, color=WHITE)])
    mini_pyramid(s.shapes, 11.85, 1.95, {4, 5}, "Tingkat 4–5")


def s14_tingkat_6_7():
    s = content_slide(K3, "Tingkat 6–7: peraturan daerah",
                      "Sumber: Pasal 1 angka 7–8 dan Pasal 14 UU No. 12 Tahun 2011; "
                      "Pasal 18 ayat (6) UUD NRI 1945")
    items = [("6", "Perda Provinsi", "Dibentuk DPRD Provinsi dengan persetujuan bersama Gubernur."),
             ("7", "Perda Kabupaten/Kota",
              "Dibentuk DPRD Kabupaten/Kota dengan persetujuan bersama Bupati/Wali Kota.")]
    lw = 5.35
    for k, (n, head, text) in enumerate(items):
        y = 1.85 + k * 1.68
        card(s.shapes, M, y, lw, 1.5, name=head)
        badge(s.shapes, M + 0.55, y + 0.75, 0.62, n, fill=GOLD, color=NAVY, size=24)
        add_text(s.shapes, M + 1.05, y, lw - 1.25, 1.5,
                 [P(head, size=22, bold=True, font=HEAD, color=NAVY, after=4), P(text, size=17)], anchor="m")
    fx = M + lw + 0.25
    box(s.shapes, ROUND, fx, 1.85, M + 9.85 - fx, 3.18, fill=NAVY, radius=0.08,
        paras=[P("FUNGSI", size=16, bold=True, color=GOLD, spc=1.2, after=12),
               P("Menyelenggarakan otonomi daerah", size=18, color=IVORY, bullet=GOLD, after=10),
               P("Melaksanakan tugas pembantuan", size=18, color=IVORY, bullet=GOLD, after=10),
               P("Menjabarkan aturan yang lebih tinggi", size=18, color=IVORY, bullet=GOLD)],
        anchor="m", margins=(0.35, 0.2, 0.3, 0.2), name="Fungsi Perda")
    warn(s.shapes, M, 5.3, 9.85, 0.95,
         [P("Muatan lokal tidak boleh bertentangan dengan aturan nasional.", size=20, bold=True, color=WHITE)])
    mini_pyramid(s.shapes, 11.85, 1.95, {6, 7}, "Tingkat 6–7")


def s15_pasal_8():
    s = content_slide(K3, "Pasal 8, bukan tingkat kedelapan",
                      "Sumber: Pasal 8 ayat (1) dan ayat (2) UU No. 12 Tahun 2011")
    grp = s.shapes.add_group_shape()
    grp.name = "Piramida Pasal 7"
    tiers = pyramid(grp.shapes, 2.55, 1.95, 2.85, 0.75, 3.55, [NAVY] * 7, gap=0.05)
    for i, t in enumerate(tiers):
        fill_tf(t["shape"].text_frame, [P(str(i + 1), size=16, bold=True, font=HEAD, color=GOLD, align="c")],
                anchor="m")
    add_text(grp.shapes, 0.6, 4.92, 3.9, 0.36, [P("Pasal 7: tujuh tingkat", size=16, bold=True, color=NAVY,
                                                   align="c")])
    bx, by = 4.85, 1.9
    bw, bh = SW - M - bx, 3.25
    box(s.shapes, ROUND, bx, by, bw, bh, fill=WHITE, line=NAVY, line_w=1.5, dash=MSO_LINE_DASH_STYLE.DASH,
        radius=0.12, name="Pasal 8")
    add_text(s.shapes, bx + 0.25, by + 0.14, bw - 0.5, 0.36,
             [P("PASAL 8 · DI LUAR PIRAMIDA, TETAP MENGIKAT", size=16, bold=True, color=GOLD_DK, spc=1.0)],
             anchor="m")
    chips = ["Peraturan menteri (Permen)", "Peraturan Mahkamah Agung (Perma)",
             "Peraturan lembaga: MK, BPK, KY, Bank Indonesia", "Peraturan gubernur (Pergub)",
             "Peraturan bupati/wali kota (Perbup/Perwali)", "Peraturan kepala desa atau yang setingkat"]
    cw2 = (bw - 0.5 - 0.2) / 2
    for k, c in enumerate(chips):
        row, col = divmod(k, 2)
        card(s.shapes, bx + 0.25 + col * (cw2 + 0.2), by + 0.6 + row * 0.68, cw2, 0.6, radius=0.1,
             paras=[P(c, size=16)], anchor="m", margins=(0.15, 0.02, 0.15, 0.02), name=f"Pasal 8 contoh {k + 1}")
    card(s.shapes, bx + 0.25, by + 0.6 + 3 * 0.68 + 0.02, bw - 0.5, 0.46, line=MAROON, line_w=1.5, radius=0.1,
         paras=[P(R("Perppu bukan di sini: ", bold=True, color=MAROON), "ia sederajat UU, di tingkat 3.",
                  size=16)], anchor="m", margins=(0.15, 0.02, 0.15, 0.02), name="Perppu bukan Pasal 8")
    cw2b = (CW - 0.3) / 2
    callout(s.shapes, M, 5.38, cw2b, 1.0, "Syarat mengikat: ",
            "diperintahkan peraturan yang lebih tinggi atau dibentuk berdasarkan kewenangan.", size=17,
            name="Syarat mengikat")
    warn(s.shapes, M + cw2b + 0.3, 5.38, cw2b, 1.0,
         [P("Tidak boleh memuat materi yang hanya boleh diatur di tingkat lebih tinggi.", size=18, bold=True,
            color=WHITE)])


def s16_materi_muatan():
    s = content_slide(K3, "Materi muatan, versi singkat",
                      "Sumber: Pasal 10–15 UU No. 12 Tahun 2011; ketentuan pidana Pasal 15 telah disesuaikan "
                      "oleh UU No. 1 Tahun 2026")
    cols = [1.45, 2.85, 4.2, CW - 1.45 - 2.85 - 4.2]
    tbl = table(s.shapes, M, 1.85, cols, [0.55, 0.84, 0.84, 0.84, 0.84], name="Tabel materi muatan")
    for j, h in enumerate(["Bentuk", "Dibentuk oleh", "Fungsi inti", "Contoh ilustrasi"]):
        cell(tbl, 0, j, [P(h, size=16, bold=True, color=GOLD)], fill=NAVY, line=None)
    data = [("UU", "DPR dengan persetujuan bersama Presiden",
             "Mengatur lebih lanjut UUD dan memenuhi kebutuhan hukum masyarakat",
             "Misalnya UU No. 12 Tahun 2011 ini sendiri"),
            ("PP", "Presiden", "Menjalankan undang-undang sebagaimana mestinya",
             "Misalnya PP pelaksana UU Aparatur Sipil Negara"),
            ("Perpres", "Presiden", "Perintah peraturan lebih tinggi; penyelenggaraan pemerintahan",
             "Misalnya Perpres tentang organisasi kementerian"),
            ("Perda", "DPRD dengan persetujuan bersama kepala daerah",
             "Otonomi daerah, tugas pembantuan, kondisi khusus daerah",
             "Misalnya Perda pajak dan retribusi daerah atau Perda tata ruang")]
    for i, row in enumerate(data, start=1):
        cell(tbl, i, 0, [P(row[0], size=20, bold=True, font=HEAD, color=NAVY)])
        for j in (1, 2, 3):
            cell(tbl, i, j, [P(row[j], size=16)])
    warn(s.shapes, M, 6.02, CW, 0.58,
         [P("Ketentuan pidana hanya dapat dimuat dalam UU dan Perda (Pasal 15).", size=18, bold=True,
            color=WHITE)])


def s17_alur():
    s = content_slide(K4, "Dari gagasan menjadi hukum yang berlaku",
                      "Sumber: Pasal 1 angka 1, Pasal 81, dan Pasal 87 UU No. 12 Tahun 2011")
    steps = [("Perencanaan", "Prolegnas untuk UU; Prolegda untuk Perda"),
             ("Penyusunan", "Naskah akademik bila diwajibkan, lalu rancangan"),
             ("Pembahasan", "UU: DPR dan Presiden. Perda: DPRD dan kepala daerah"),
             ("Pengesahan atau penetapan", "Ditandatangani Presiden atau kepala daerah"),
             ("Pengundangan", "Lembaran Negara, Berita Negara, atau Lembaran Daerah")]
    gap, ah, tip = 0.1, 1.2, 0.34
    aw = (CW - 4 * gap) / 5
    for i, (name, cap) in enumerate(steps):
        x = M + i * (aw + gap)
        shp = box(s.shapes, MSO_SHAPE.PENTAGON, x, 1.95, aw, ah, fill=NAVY, name=f"Tahap {i + 1}")
        shp.adjustments[0] = tip / min(aw, ah)
        add_text(s.shapes, x + 0.16, 1.95, aw - tip - 0.16, ah,
                 [P(str(i + 1), size=24, bold=True, font=HEAD, color=GOLD, line=0.9),
                  P(name, size=17, bold=True, color=IVORY, line=0.95)], anchor="m", name=f"Nama tahap {i + 1}")
        card(s.shapes, x, 3.35, aw - 0.15, 1.7, paras=[P(cap, size=16)], anchor="t",
             margins=(0.18, 0.15, 0.18, 0.1), name=f"Keterangan tahap {i + 1}")
    callout(s.shapes, M, 5.35, CW, 0.65, "Akibat hukum: ",
            "belum diundangkan berarti belum berlaku sebagai peraturan perundang-undangan.")


def s18_partisipasi():
    s = content_slide(K4, "Partisipasi yang bermakna",
                      "Sumber: Pasal 96 UU No. 12 Tahun 2011 sebagaimana diubah UU No. 13 Tahun 2022; "
                      "Putusan MK No. 91/PUU-XVIII/2020")
    w3 = (CW - 2 * 0.3) / 3
    rights = [("Didengar", "Hak untuk didengar pendapatnya", "right to be heard"),
              ("Dipertimbangkan", "Hak untuk dipertimbangkan pendapatnya", "right to be considered"),
              ("Dijelaskan", "Hak mendapat penjelasan atas hasil pembahasan masukan", "right to be explained")]
    for i, (head, text, eng) in enumerate(rights):
        box(s.shapes, ROUND, M + i * (w3 + 0.3), 1.85, w3, 1.85, fill=NAVY, radius=0.08,
            paras=[P(head, size=24, bold=True, font=HEAD, color=GOLD, after=6),
                   P(text, size=18, color=IVORY, after=6),
                   P(eng, size=16, italic=True, color=ON_NAVY)],
            anchor="m", margins=(0.3, 0.15, 0.3, 0.15), name=f"Hak {head.lower()}")
    info = [("Siapa", "Orang atau kelompok yang terdampak langsung dan/atau berkepentingan"),
            ("Cara", "Lisan atau tertulis; daring atau luring"),
            ("Akses", "Naskah akademik dan rancangan mudah diakses masyarakat")]
    for i, (lab, text) in enumerate(info):
        card(s.shapes, M + i * (w3 + 0.3), 3.9, w3, 1.45,
             paras=[P(lab, size=18, bold=True, font=HEAD, color=NAVY, after=4), P(text, size=16)],
             anchor="m", margins=(0.3, 0.1, 0.3, 0.1), name=lab)
    box(s.shapes, ROUND, M, 5.55, CW, 1.05, fill=GOLD_TINT,
        paras=[P("Bukan sekadar sosialisasi setelah naskah selesai.", size=22, bold=True, font=HEAD, color=NAVY,
                 after=4),
               P(R("Akibat hukum: ", bold=True, color=NAVY),
                 "partisipasi yang tidak bermakna dapat menjadi alasan pengujian formil.", size=17)],
        anchor="m", margins=(0.3, 0.06, 0.3, 0.06), name="Pesan partisipasi")


def s19_omnibus():
    s = content_slide(K4, "Metode omnibus",
                      "Sumber: Pasal 42A dan Pasal 64 UU No. 12 Tahun 2011 sebagaimana diubah UU No. 13 Tahun 2022")
    add_text(s.shapes, M, 1.85, 6.6, 0.45, [P("Satu peraturan dapat sekaligus:", size=20, bold=True, color=NAVY)])
    items = ["Memuat materi muatan baru;",
             "Mengubah materi terkait dalam berbagai peraturan yang jenis dan hierarkinya sama; dan/atau",
             "Mencabut peraturan yang setingkat, lalu menggabungkannya ke dalam satu peraturan."]
    for k, it in enumerate(items):
        y = 2.45 + k * 0.9
        badge(s.shapes, M + 0.27, y + 0.4, 0.5, str(k + 1), size=18)
        add_text(s.shapes, M + 0.7, y, 5.95, 0.8, [P(it, size=18)], anchor="m")
    for j, lab in enumerate(["UU A", "UU B", "UU C"]):
        y = 2.05 + j * 0.85
        card(s.shapes, 7.45, y, 1.55, 0.62, line=NAVY, line_w=1.25,
             paras=[P(lab, size=18, bold=True, color=NAVY, align="c")], anchor="m", name=lab)
        arrow(s.shapes, 9.0, y + 0.31, 10.08, 3.12, color=NAVY, width=1.75)
    box(s.shapes, ROUND, 10.1, 2.32, SW - M - 10.1, 1.6, fill=NAVY, radius=0.1,
        paras=[P("Satu UU", size=24, bold=True, font=HEAD, color=IVORY, align="c", after=2),
               P("metode omnibus", size=17, color=GOLD, align="c")], anchor="m", name="Hasil omnibus")
    add_text(s.shapes, 7.45, 4.52, SW - M - 7.45, 0.45,
             [P("Jenis dan hierarki harus sama", size=17, bold=True, color=NAVY, align="c")])
    cw2 = (CW - 0.3) / 2
    callout(s.shapes, M, 5.3, cw2, 1.05, "Syarat: ",
            "penggunaannya ditetapkan sejak dokumen perencanaan.", name="Syarat omnibus")
    warn(s.shapes, M + cw2 + 0.3, 5.3, cw2, 1.05,
         [P("Bukan jalan pintas untuk meloncati hierarki.", size=20, bold=True, color=WHITE)])


def s20_pengujian():
    s = content_slide(K4, "Jika peraturan bermasalah",
                      "Sumber: Pasal 9 UU No. 12 Tahun 2011; Pasal 24A ayat (1) dan Pasal 24C ayat (1) UUD NRI 1945")
    cw2 = (CW - 0.3) / 2
    courts = [("Mahkamah Konstitusi", ("Menguji undang-undang", "terhadap UUD 1945"),
               "Pengujian formil maupun materiil"),
              ("Mahkamah Agung", ("Menguji peraturan di bawah UU", "terhadap undang-undang"),
               "Misalnya PP, Perpres, Perda, dan peraturan menteri")]
    for k, (court, (obj1, obj2), extra) in enumerate(courts):
        box(s.shapes, ROUND, M + k * (cw2 + 0.3), 1.85, cw2, 2.45, fill=NAVY, radius=0.08,
            paras=[P(court, size=26, bold=True, font=HEAD, color=GOLD, after=10),
                   P(obj1, size=20, bold=True, color=IVORY),
                   P(obj2, size=20, bold=True, color=IVORY, after=8),
                   P(extra, size=17, color=ON_NAVY)],
            anchor="m", margins=(0.4, 0.2, 0.4, 0.2), name=court)
    defs = [("Uji formil: ", "cacat dalam prosedur pembentukan."),
            ("Uji materiil: ", "isi bertentangan dengan aturan yang lebih tinggi.")]
    for k, (a, b) in enumerate(defs):
        card(s.shapes, M + k * (cw2 + 0.3), 4.5, cw2, 0.85,
             paras=[P(R(a, bold=True, color=NAVY), b, size=18)], anchor="m",
             margins=(0.3, 0.06, 0.3, 0.06), name=a.strip(": "))
    callout(s.shapes, M, 5.6, CW, 0.75, "Akibat hukum: ",
            "mengikuti amar putusan—misalnya dinyatakan tidak mengikat, atau batal.")


def s21_kasus():
    s = content_slide(K4, "Contoh kerja: kasus ilustrasi",
                      "Ilustrasi fiktif · Dasar analisis: Pasal 7 dan Pasal 9 UU No. 12 Tahun 2011")
    lw = 6.9
    box(s.shapes, ROUND, M, 1.85, 2.9, 0.42, line=SLATE, line_w=1.25, radius=0.21,
        paras=[P("ILUSTRASI FIKTIF", size=16, bold=True, color=SLATE, spc=1.0, align="c")],
        anchor="m", margins=(0.1, 0, 0.1, 0), name="Label fiktif")
    box(s.shapes, ROUND, M, 2.45, lw, 1.3, fill=NAVY, radius=0.08,
        paras=[P("UU X (rekaan)", size=16, bold=True, color=GOLD, after=4),
               P("Pedagang keliling cukup mendaftar ke pemerintah daerah.", size=20, color=IVORY)],
        anchor="m", margins=(0.35, 0.12, 0.35, 0.12), name="UU rekaan")
    box(s.shapes, ROUND, M + lw / 2 - 1.2, 3.88, 2.4, 0.46, fill=MAROON, radius=0.23,
        paras=[P("bertentangan", size=16, bold=True, color=WHITE, align="c")], anchor="m",
        margins=(0, 0, 0, 0), name="Konflik norma")
    card(s.shapes, M, 4.47, lw, 1.3, line=MAROON, line_w=2.0,
         paras=[P("Perda Kabupaten Contoh (fiktif)", size=16, bold=True, color=MAROON, after=4),
                P("Pedagang keliling dilarang di seluruh wilayah kabupaten.", size=20)],
         anchor="m", margins=(0.35, 0.12, 0.35, 0.12), name="Perda fiktif")
    qx = M + lw + 0.4
    qw = SW - M - qx
    add_text(s.shapes, qx, 1.85, qw, 0.42, [P("Diskusikan berpasangan:", size=18, bold=True, color=NAVY)],
             anchor="m")
    for k, q in enumerate(["Tingkat mana yang menang?", "Asas apa yang dipakai?", "Ke mana Perda ini diuji?"]):
        y = 2.45 + k * 1.16
        card(s.shapes, qx, y, qw, 0.98, name=f"Pertanyaan {k + 1}")
        badge(s.shapes, qx + 0.5, y + 0.49, 0.56, str(k + 1))
        add_text(s.shapes, qx + 0.95, y, qw - 1.1, 0.98, [P(q, size=20, bold=True, color=NAVY)], anchor="m")
    add_text(s.shapes, M, 6.05, CW, 0.45,
             [P("Satu menit diskusi, lalu bahas jawabannya bersama.", size=17, italic=True)])


def s22_penutup():
    s = content_slide("PENUTUP", "Yang perlu diingat", None)
    box(s.shapes, ROUND, M, 1.85, 6.75, 4.75, fill=NAVY, radius=0.05, name="Tiga pesan")
    msgs = ["Hierarki adalah urutan kekuatan, bukan sekadar urutan bab.",
            "Bentuk yang salah tempat membuat aturan rentan dibatalkan.",
            "Pembentukan yang sah memerlukan lembaga yang tepat, prosedur, dan partisipasi yang bermakna."]
    for k, m in enumerate(msgs):
        y = 2.1 + k * 1.45
        add_text(s.shapes, M + 0.35, y, 0.7, 1.25, [P(str(k + 1), size=40, bold=True, font=HEAD, color=GOLD)])
        add_text(s.shapes, M + 1.15, y + 0.08, 5.3, 1.25, [P(m, size=22, font=HEAD, color=IVORY)],
                 name=f"Pesan {k + 1}")
    sx = M + 6.75 + 0.45
    add_text(s.shapes, sx, 1.85, SW - M - sx, 0.4,
             [P("SUMBER", size=16, bold=True, color=GOLD_DK, spc=1.2)], anchor="m")
    src = ["UUD NRI Tahun 1945: Pasal 1 ayat (3), 20, 22A, dan\u00a037",
           "UU No. 12 Tahun 2011 tentang Pembentukan Peraturan Perundang-undangan",
           "UU No. 15 Tahun 2019 tentang Perubahan atas UU 12/2011",
           "UU No. 13 Tahun 2022 tentang Perubahan Kedua atas UU 12/2011",
           "peraturan.bpk.go.id — tempat memeriksa teks resmi"]
    add_text(s.shapes, sx, 2.35, SW - M - sx, 4.25, [P(t, size=16, bullet=GOLD_DK, after=12) for t in src],
             name="Daftar sumber")


def s23_terima_kasih():
    s = prs.slides.add_slide(L_TITLE)
    set_bg(s, NAVY)
    t = s.shapes.title
    place(t, 0.8, 1.9, 8.4, 1.3)
    fill_tf(t.text_frame, [P("Terima kasih", size=60, bold=True, font=HEAD, color=IVORY)], anchor="b")
    sub = s.placeholders[1]
    place(sub, 0.8, 3.35, 8.4, 0.6)
    fill_tf(sub.text_frame, [P("Pertanyaan dan diskusi", size=28, color=GOLD)])
    add_text(s.shapes, 0.8, 4.45, 8.4, 1.0,
             [P("PERTANYAAN PEMANTIK", size=16, bold=True, color=GOLD, spc=1.2, after=6),
              P("Di mana posisi peraturan menteri dalam tata perundang-undangan?", size=20, color=ON_NAVY)],
             name="Pertanyaan pemantik")
    deco_pyramid(s.shapes, 11.2)
    set_notes(s, 23)


def add_sections(spec):
    """Bagian (section) PowerPoint agar mudah dinavigasi di panel slide."""
    p14 = "http://schemas.microsoft.com/office/powerpoint/2010/main"
    pres = prs.part._element
    ids = [el.get("id") for el in pres.find(qn("p:sldIdLst"))]
    ext_lst = pres.find(qn("p:extLst"))
    if ext_lst is None:
        ext_lst = etree.SubElement(pres, qn("p:extLst"))
    ext = etree.SubElement(ext_lst, qn("p:ext"))
    ext.set("uri", "{521415D9-36F7-43E2-AB2F-B90AF26B5E84}")
    sec_lst = etree.SubElement(ext, "{%s}sectionLst" % p14, nsmap={"p14": p14})
    for name, first, last in spec:
        sec = etree.SubElement(sec_lst, "{%s}section" % p14)
        sec.set("name", name)
        sec.set("id", "{%s}" % str(uuid.uuid4()).upper())
        lst = etree.SubElement(sec, "{%s}sldIdLst" % p14)
        for i in range(first - 1, last):
            etree.SubElement(lst, "{%s}sldId" % p14).set("id", ids[i])


for build in (s01_sampul, s02_tujuan, s03_peta, s04_apa_itu_peraturan, s05_ciri_pembeda, s06_mengapa_ditata,
              s07_arti_tata, s08_tiga_asas, s09_tiga_hal, s10_asas_pembentukan, s11_piramida, s12_tingkat_1_3,
              s13_tingkat_4_5, s14_tingkat_6_7, s15_pasal_8, s16_materi_muatan, s17_alur, s18_partisipasi,
              s19_omnibus, s20_pengujian, s21_kasus, s22_penutup, s23_terima_kasih):
    build()

add_sections([("Pembuka", 1, 3), ("Bab 1 — Peraturan", 4, 6),
              ("Bab 2 — Pengertian tata perundang-undangan", 7, 10),
              ("Bab 3 — Jenis dan tata urutan", 11, 16), ("Bab 4 — Implementasi", 17, 21),
              ("Penutup", 22, 23)])

prs.save(OUT)
print("Tersimpan:", OUT, "|", len(prs.slides), "slide")
