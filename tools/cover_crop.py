"""Builds raw/cover_ticket.png: the real ticket thread crop placed on the right of a canvas
filled with the Discord chat background, so the cover band (left 620 px) never hides it."""
from pathlib import Path

from PIL import Image

root = Path(__file__).resolve().parent.parent
shot = Image.open(root / "raw" / "ticket_open.png").convert("RGB")
bg = shot.getpixel((1500, 1600))

# Ticket card, the moderator reply and the claim note: the part a buyer should read.
card = shot.crop((110, 430, 1210, 1380))
card = card.resize((int(card.width * 1.12), int(card.height * 1.12)), Image.LANCZOS)
w, h = 2560, 1538
canvas = Image.new("RGB", (w, h), bg)
x = w - card.width - 70
y = (h - card.height) // 2
canvas.paste(card, (x, y))
canvas.save(root / "raw" / "cover_ticket.png")
print("cover_ticket.png", canvas.size, "card at", x, y, "bg", bg)
