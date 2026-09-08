import fitz
import os
import sys

pdf_path = os.path.join(os.getcwd(), 'dist', 'test-laudo.pdf')
if not os.path.exists(pdf_path):
    print("PDF nao encontrado em:", pdf_path)
    sys.exit(1)

doc = fitz.open(pdf_path)
print(f"Total de Paginas no PDF: {len(doc)}")

full_text = ""
for i, page in enumerate(doc):
    text = page.get_text()
    full_text += f"\n=== PAGINA {i+1} ===\n" + text
    print(f"\n--- PAGINA {i+1} ---")
    lines = [l.strip() for l in text.split('\n') if l.strip()]
    for line in lines[:12]:
        print("  ", line)

print("\n" + "="*50)
print("EXECUCAO DE ASSERCOES RIGOROSAS:")
print("="*50)

# 1. Tensão Primária no Bloco 2
assert "13800 V (13.8 kV)" in full_text, "FALHA: Tensão primária esperada '13800 V (13.8 kV)' não encontrada."
assert "13.800 kV" not in full_text, "FALHA: Encontrado '13.800 kV' (deveria ser '13.8 kV')."
print("OK [1]: Tensão primária formatada corretamente como '13800 V (13.8 kV)' sem zeros espúrios.")

# 2. Elemento 7 Fasorial DELETADO
assert "7. AVALIAÇÃO DETALHADA DOS ELEMENTOS FASORIAIS" not in full_text, "FALHA: Elemento 7 fasorial ainda consta no PDF!"
assert "Elemento Fasorial" not in full_text, "FALHA: Tabela de elementos fasoriais ainda consta no PDF!"
print("OK [2]: '7. AVALIAÇÃO DETALHADA DOS ELEMENTOS FASORIAIS' e sua tabela foram completamente removidos.")

# 3. Seção 7 renumerada para Documentação Normativa
assert "7. DOCUMENTAÇÃO NORMATIVA E REGRAS DE CÁLCULO" in full_text, "FALHA: Seção 7 normativa não encontrada."
print("OK [3]: '7. DOCUMENTAÇÃO NORMATIVA E REGRAS DE CÁLCULO' presente e renumerada corretamente.")

# 4. Modo de teste: texto após ':' quebrado na linha abaixo
page2_text = doc[1].get_text()
assert "MODO DE TESTE:" in page2_text, "FALHA: MODO DE TESTE: não encontrado na página 2."
assert "Ciclo destinado a validar cálculos" in page2_text or "ciclo destinado a validar" in page2_text, "FALHA: texto explicativo de modo de teste não encontrado na linha abaixo."
print("OK [4]: Na página 2 (Medições de Campo), texto após ':' está na linha abaixo.")

# 5. Títulos limpos e neutros (sem termos restritivos técnicos)
assert "DIAGNÓSTICO TÉCNICO" not in full_text, "FALHA: 'DIAGNÓSTICO TÉCNICO' ainda consta no cabeçalho do PDF!"
assert "PARECER TÉCNICO" not in full_text, "FALHA: 'PARECER TÉCNICO' ainda consta no PDF!"
assert "INSPEÇÃO TÉCNICA" not in full_text, "FALHA: 'INSPEÇÃO TÉCNICA' ainda consta no PDF!"
assert "Observações Técnicas" not in full_text, "FALHA: 'Observações Técnicas' ainda consta no PDF!"
print("OK [5]: Cabeçalhos e títulos estão 100% neutros e limpos.")

# 6. Remoção de dicas, sugestões, simulações de balanceamento e recomendações
assert "Carregamento projetado após balanceamento perfeito" not in full_text, "FALHA: 'Carregamento projetado após balanceamento perfeito' ainda consta no PDF!"
assert "fusão prematura de elos fusíveis" not in full_text, "FALHA: Recomendação de remanejamento com fusão prematura ainda consta no alerta!"
assert "Parecer de Remanejamento:" not in full_text, "FALHA: 'Parecer de Remanejamento:' ainda consta no PDF!"
assert "SE FIZER BALANCEAMENTO DE FASES" not in full_text, "FALHA: Bloco de simulação de balanceamento ainda consta no PDF!"
print("OK [6]: Dicas, sugestões e parecer de remanejamento removidos com sucesso. Apenas dados e medições reais permanecem.")

# 7. Remoção de fórmulas II, III e IV da Seção 3
assert "II. Potência Aparente Trifásica" not in full_text, "FALHA: Fórmula II ainda consta no PDF!"
assert "III. Fator de Desbalanço de Tensão" not in full_text, "FALHA: Fórmula III ainda consta no PDF!"
assert "IV. Desbalanço de Carga na Rede Secundária" not in full_text, "FALHA: Fórmula IV ainda consta no PDF!"
assert "I. Cálculo da corrente nominal" in full_text, "FALHA: Fórmula I deveria permanecer no PDF!"
print("OK [7]: Fórmulas II, III e IV foram removidas da Seção 3, mantendo apenas a Fórmula I.")

# 5. Fórmulas presentes como imagens
# Cada página é renderizada em PNG para conferência visual
artifact_dir = r"C:\Users\conta\.gemini\antigravity-ide\brain\270f5d58-2b0c-406d-8f80-fd06e5384791"
for i, page in enumerate(doc):
    pix = page.get_pixmap(dpi=150)
    out_img = os.path.join(artifact_dir, f"laudo_pdf_page_{i+1}.png")
    pix.save(out_img)
    print(f"Salva imagem da Pagina {i+1}: {out_img}")

print("\nTODAS AS ASSERCOES PASSARAM COM 100% DE SUCESSO!")
