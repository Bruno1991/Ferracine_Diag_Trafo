import os
import sys
import base64
import fitz
from PIL import Image, ImageDraw, ImageFont

os.makedirs('public/formulas', exist_ok=True)

# 1. Recorte da NDU 006 - Corrente Nominal Trifásica (página 178)
doc_ndu6 = fitz.open('docs-pdf/NDU 006 - CRITÉRIOS BÁSICOS PARA ELABORAÇÃO DE PROJETOS DE REDES DE DISTRIBUIÇÃO EM ÁREAS URBANAS.pdf')
page178 = doc_ndu6[177]
clip1 = fitz.Rect(90, 440, 480, 560)
pix1 = page178.get_pixmap(clip=clip1, dpi=300)
pix1.save('public/formulas/formula_in_trifasica.png')
print('1. formula_in_trifasica.png:', pix1.width, 'x', pix1.height)

# 2. Recorte da NDU 007 - Corrente Nominal Monofásica (página 189)
doc_ndu7 = fitz.open('docs-pdf/NDU 007 - CRITÉRIOS BÁSICOS PARA ELABORAÇÃO DE PROJETOS DE REDES DE DISTRIBUIÇÃO EM ÁREAS RURAIS.pdf')
page189 = doc_ndu7[188]
clip2 = fitz.Rect(90, 570, 480, 650)
pix2 = page189.get_pixmap(clip=clip2, dpi=300)
pix2.save('public/formulas/formula_in_monofasica.png')
print('2. formula_in_monofasica.png:', pix2.width, 'x', pix2.height)

# 3. Recorte do PRODIST Módulo 8 - FDTP e Beta (página 14)
doc_prodist = fitz.open('docs-pdf/Prodist_modulo_8_v14.pdf')
page14 = doc_prodist[13]
clip3 = fitz.Rect(75, 528, 540, 735)
pix3 = page14.get_pixmap(clip=clip3, dpi=300)
pix3.save('public/formulas/formula_prodist_fdtp.png')
print('3. formula_prodist_fdtp.png:', pix3.width, 'x', pix3.height)

# Função auxiliar para criar imagem com padrão visual das normas da Energisa
def create_styled_formula_image(title, equation_lines, filename, width=1625, height=520):
    img = Image.new('RGB', (width, height), color=(255, 255, 255))
    draw = ImageDraw.Draw(img)

    # Tenta carregar fontes do Windows ou fallback
    try:
        font_title = ImageFont.truetype('arialbd.ttf', 38)
        font_eq = ImageFont.truetype('times.ttf', 42)
        font_bold = ImageFont.truetype('timesbd.ttf', 42)
        font_small = ImageFont.truetype('arial.ttf', 28)
    except:
        font_title = ImageFont.load_default()
        font_eq = ImageFont.load_default()
        font_bold = ImageFont.load_default()
        font_small = ImageFont.load_default()

    # Título em laranja/âmbar padrão norma Energisa
    draw.text((25, 22), title, font=font_title, fill=(234, 88, 12))

    # Caixa retangular cinza
    box_x0 = 25
    box_y0 = 80
    box_x1 = width - 25
    box_y1 = height - 25
    draw.rectangle([box_x0, box_y0, box_x1, box_y1], outline=(100, 116, 139), width=2)

    # Conteúdo das equações
    curr_y = box_y0 + 35
    for line in equation_lines:
        draw.text((box_x0 + 40, curr_y), line, font=font_eq, fill=(15, 23, 42))
        curr_y += 65

    img.save(f'public/formulas/{filename}')
    print(f'Generated public/formulas/{filename}')

# 4. Potência Aparente e Carregamento (IEEE Std 1459 / NBR 5356-7 / NDU 006)
create_styled_formula_image(
    'II. Potência Aparente Trifásica e Carregamento por Fase (IEEE Std 1459 / NBR 5356-7):',
    [
        'S (kVA) = ( Van · Ia + Vbn · Ib + Vcn · Ic ) / 1000   ou   S = ( √3 · V_méd · I_méd ) / 1000',
        'Carregamento Fase (%) = ( I_fase / I_nominal ) × 100   [Limite: pico da fase mais carregada]'
    ],
    'formula_potencia_carregamento.png',
    width=1625,
    height=440
)

# 5. Desequilíbrio de Corrente na Rede Secundária BT (NDU 006 / NDU 007)
create_styled_formula_image(
    'III. Desequilíbrio de Carga na Rede Secundária BT (NDU 006 / NDU 007):',
    [
        'Desvio de Carga (%) = 100 × máx | I_fase - I_média | / I_média',
        'Limiar Normativo de Triagem: Desvio máximo admissível = 15% (critério de remanejamento)'
    ],
    'formula_desequilibrio_bt.png',
    width=1625,
    height=440
)

# 6. Perdas no Cobre e Rendimento sob Carga (NBR 5356-7 / Física Joule)
create_styled_formula_image(
    'IV. Perdas no Cobre sob Carga e Rendimento Operacional (NBR 5356-7):',
    [
        'Pk(I) = Pk,75°C × [ ( Ia² + Ib² + Ic² ) / ( 3 × I_nominal² ) ]   (Física das perdas Joule)',
        'Rendimento sob Carga η (%) = [ P_ativa / ( P_ativa + P0 + Pk(I) ) ] × 100'
    ],
    'formula_perdas_rendimento.png',
    width=1625,
    height=440
)

# Agora gerar o módulo TypeScript com as constantes Base64
out_ts = 'src/utils/formulaImages.ts'
img_dir = 'public/formulas'
lines = ['// Auto-generated formula images in Base64 DataURLs', '']

for f in sorted(os.listdir(img_dir)):
    if f.endswith('.png'):
        var_name = f.replace('.png', '').upper()
        p = os.path.join(img_dir, f)
        with open(p, 'rb') as fp:
            b64 = base64.b64encode(fp.read()).decode('utf-8')
        lines.append(f'export const {var_name}_PNG = "data:image/png;base64,{b64}";')

with open(out_ts, 'w', encoding='utf-8') as fp:
    fp.write('\n'.join(lines) + '\n')

print('Success! Generated', out_ts, 'with all formula images.')
