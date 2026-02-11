# cURL – Endpoints de Listagens (Listings)

Substitua `SEU_TOKEN` pelo token retornado no login (`POST /auth/login` ou `POST /auth/google`). Base URL: `http://localhost:3333`.

**Fotos:** o body aceita um array `photos` (URLs ou base64). Mínimo 1 foto, máximo **5 fotos** por anúncio. Limite de body: 20MB.

---

## POST /listings – Criar anúncio

### Venda (preço obrigatório)

```bash
curl -X POST "http://localhost:3333/listings" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer SEU_TOKEN" \
  -d '{
    "name": "Berço usado em bom estado",
    "description": "Berço de madeira, usado por 1 ano. Sem defeitos, inclui colchão. Marca X, modelo Y.",
    "condition": "Usado - Bom",
    "listingType": "venda",
    "price": 150.00,
    "message": "Entrego em mãos na região central.",
    "city": "São Paulo",
    "photos": ["https://exemplo.com/foto1.jpg"]
  }'
```

### Doação (sem preço)

```bash
curl -X POST "http://localhost:3333/listings" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer SEU_TOKEN" \
  -d '{
    "name": "Roupas de bebê 0 a 6 meses",
    "description": "Lote de roupas em bom estado, diversas peças. Marca A e B, tamanhos RN e P.",
    "condition": "Usado - Excelente",
    "listingType": "doacao",
    "message": "Retirar em domicílio.",
    "city": "Curitiba",
    "photos": ["https://exemplo.com/roupas.jpg"]
  }'
```

### Troca (sem preço)

```bash
curl -X POST "http://localhost:3333/listings" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer SEU_TOKEN" \
  -d '{
    "name": "Carrinho de bebê compacto",
    "description": "Carrinho em ótimo estado, pouco uso. Aceito troca por moisés ou berço.",
    "condition": "Usado - Excelente",
    "listingType": "troca",
    "city": "Rio de Janeiro",
    "photos": ["https://exemplo.com/carrinho.jpg"]
  }'
```

---

## GET /listings – Listar anúncios (com filtro por tipo)

```bash
# Todos
curl "http://localhost:3333/listings"

# Filtro por tipo (doação, troca ou venda)
curl "http://localhost:3333/listings?listingType=venda"      # só vendas
curl "http://localhost:3333/listings?listingType=doacao"    # só doações
curl "http://localhost:3333/listings?listingType=troca"     # só trocas
curl "http://localhost:3333/listings?listingType=doacao,troca"  # doação ou troca (múltiplos tipos)

# Com busca, cidade e paginação
curl "http://localhost:3333/listings?q=berço&listingType=venda&city=São Paulo&page=1&limit=12"
```

---

## GET /listings/:id – Detalhes de um anúncio

```bash
curl "http://localhost:3333/listings/UUID_DO_ANUNCIO"
```

---

## PUT /listings/:id – Atualizar anúncio

```bash
# Exemplo: alterar para venda e definir preço
curl -X PUT "http://localhost:3333/listings/UUID_DO_ANUNCIO" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer SEU_TOKEN" \
  -d '{
    "listingType": "venda",
    "price": 200.00
  }'
```

---

## DELETE /listings/:id – Excluir anúncio

```bash
curl -X DELETE "http://localhost:3333/listings/UUID_DO_ANUNCIO" \
  -H "Authorization: Bearer SEU_TOKEN"
```
