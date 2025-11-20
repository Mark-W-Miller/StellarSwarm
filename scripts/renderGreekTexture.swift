import AppKit

let args = CommandLine.arguments
guard args.count >= 4 else {
    fputs("Usage: renderGreekTexture.swift <glyph> <name> <outPath>\n", stderr)
    exit(1)
}

let glyph = args[1]
let name = args[2]
let outPath = args[3]

let size: CGFloat = 256
let bgColor = NSColor(calibratedRed: 11/255, green: 17/255, blue: 34/255, alpha: 1)
let textColor = NSColor(calibratedRed: 250/255, green: 204/255, blue: 21/255, alpha: 1)

let image = NSImage(size: NSSize(width: size, height: size))
image.lockFocus()

bgColor.setFill()
NSBezierPath(rect: NSRect(x: 0, y: 0, width: size, height: size)).fill()

let fontSize: CGFloat = size * 0.65
let font = NSFont(name: "HelveticaNeue-Bold", size: fontSize) ?? NSFont.systemFont(ofSize: fontSize, weight: .bold)
let paragraph = NSMutableParagraphStyle()
paragraph.alignment = .center

let attributes: [NSAttributedString.Key: Any] = [
    .font: font,
    .foregroundColor: textColor,
    .paragraphStyle: paragraph
]

let attributed = NSAttributedString(string: glyph, attributes: attributes)
let textSize = attributed.size()
let rect = NSRect(x: 0, y: (size - textSize.height) / 2 - size * 0.05, width: size, height: textSize.height)
attributed.draw(in: rect)

image.unlockFocus()

guard let tiff = image.tiffRepresentation,
      let rep = NSBitmapImageRep(data: tiff),
      let png = rep.representation(using: .png, properties: [:]) else {
    fputs("Failed to render texture for \(name)\n", stderr)
    exit(2)
}

do {
    try png.write(to: URL(fileURLWithPath: outPath))
    print("Created \(outPath)")
} catch {
    fputs("Failed to write \(outPath): \(error)\n", stderr)
    exit(3)
}
