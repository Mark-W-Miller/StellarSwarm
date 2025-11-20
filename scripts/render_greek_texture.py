#!/usr/bin/env python3
from AppKit import (
    NSImage,
    NSSize,
    NSColor,
    NSBezierPath,
    NSRect,
    NSFont,
    NSMutableParagraphStyle,
    NSAttributedString,
    NSBitmapImageRep,
    NSPNGFileType,
    NSFontAttributeName,
    NSForegroundColorAttributeName,
    NSParagraphStyleAttributeName,
)
import sys

if len(sys.argv) < 4:
    print("Usage: render_greek_texture.py <glyph> <name> <out>", file=sys.stderr)
    sys.exit(1)

glyph = sys.argv[1]
name = sys.argv[2]
out_path = sys.argv[3]

SIZE = 256

image = NSImage.alloc().initWithSize_(NSSize(SIZE, SIZE))
image.lockFocus()

bg = NSColor.colorWithCalibratedRed_green_blue_alpha_(11 / 255, 17 / 255, 34 / 255, 1.0)
bg.set()
NSBezierPath.fillRect_(NSRect(((0, 0), (SIZE, SIZE))))

font_size = SIZE * 0.32
font = NSFont.fontWithName_size_("HelveticaNeue-Bold", font_size)
if font is None:
    font = NSFont.boldSystemFontOfSize_(font_size)

paragraph = NSMutableParagraphStyle.alloc().init()
paragraph.setAlignment_(1)  # center

attrs = {
    NSFontAttributeName: font,
    NSForegroundColorAttributeName: NSColor.colorWithCalibratedRed_green_blue_alpha_(250 / 255, 204 / 255, 21 / 255, 1.0),
    NSParagraphStyleAttributeName: paragraph,
}
attributed = NSAttributedString.alloc().initWithString_attributes_(glyph, attrs)
text_size = attributed.size()
rect = NSRect(((0, (SIZE - text_size.height) / 2 - SIZE * 0.02), (SIZE, text_size.height)))
attributed.drawInRect_(rect)

image.unlockFocus()

tiff = image.TIFFRepresentation()
bitmap = NSBitmapImageRep.imageRepWithData_(tiff)
png = bitmap.representationUsingType_properties_(NSPNGFileType, None)
if not png:
    print(f"Failed to render texture for {name}", file=sys.stderr)
    sys.exit(2)

png.writeToFile_atomically_(out_path, True)
print(f"Created {out_path}")
