"""
Rasterizes an SVG to a PNG WITH transparency.

`qlmanage` composites the alpha over white, so a symbol on a transparent background comes out with a
white rectangle (and a white pupil disappears inside it). It is solved by rendering twice:

  A = the artwork as it is, over white
  M = the SAME shapes in black, over white  -> its luminance gives the coverage

  alpha = 1 - luminance(M)
  color = (A - white*(1-alpha)) / alpha      (un-premultiplied)

With that, the edges' antialiasing comes out right instead of clipped.
"""
import struct, subprocess, sys, zlib, re, os

def render(svg_path, size, out_bmp):
    subprocess.run(['qlmanage','-t','-s',str(size),'-o','/tmp/vv-alpha',svg_path],
                   capture_output=True)
    png = f'/tmp/vv-alpha/{os.path.basename(svg_path)}.png'
    subprocess.run(['sips','-s','format','bmp',png,'--out',out_bmp], capture_output=True)
    return out_bmp

def read_bmp(path):
    d = open(path,'rb').read()
    off = struct.unpack_from('<I',d,10)[0]
    w,h = struct.unpack_from('<ii',d,18)
    bpp = struct.unpack_from('<H',d,28)[0]
    flip = h > 0; h = abs(h); row = ((w*bpp//8)+3)//4*4
    px = []
    for y in range(h):
        yy = h-1-y if flip else y
        line = []
        for x in range(w):
            i = off + yy*row + x*(bpp//8)
            line.append((d[i+2],d[i+1],d[i]))
        px.append(line)
    return w,h,px

def write_png(path,w,h,rgba):
    raw = b''.join(b'\x00' + bytes(v for p in rgba[y] for v in p) for y in range(h))
    def chunk(t,data):
        c = t+data
        return struct.pack('>I',len(data))+c+struct.pack('>I',zlib.crc32(c)&0xffffffff)
    png = (b'\x89PNG\r\n\x1a\n'
           + chunk(b'IHDR', struct.pack('>IIBBBBB',w,h,8,6,0,0,0))
           + chunk(b'IDAT', zlib.compress(raw,9))
           + chunk(b'IEND', b''))
    open(path,'wb').write(png)

def rasterize(svg_path, size, out_png):
    src = open(svg_path).read()
    # Mask: the same shapes, all in black
    mask_svg = re.sub(r'(stroke|fill)="#[0-9A-Fa-f]{6}"', r'\1="#000000"', src)
    mask_path = '/tmp/vv-alpha/_mask.svg'
    open(mask_path,'w').write(mask_svg)

    w,h,A = read_bmp(render(svg_path, size, '/tmp/vv-alpha/_a.bmp'))
    _,_,M = read_bmp(render(mask_path, size, '/tmp/vv-alpha/_m.bmp'))

    out = []
    for y in range(h):
        line = []
        for x in range(w):
            mr,mg,mb = M[y][x]
            cov = 1.0 - (0.2126*mr + 0.7152*mg + 0.0722*mb)/255.0
            a = max(0.0, min(1.0, cov))
            if a < 0.004:
                line.append((0,0,0,0)); continue
            ar,ag,ab = A[y][x]
            # un-premultiply against the white qlmanage composited over
            c = tuple(max(0,min(255,round((v - 255*(1-a))/a))) for v in (ar,ag,ab))
            line.append((c[0],c[1],c[2],round(a*255)))
        out.append(line)
    write_png(out_png,w,h,out)
    print(f'  {os.path.basename(out_png)}  {w}x{h}  corner alpha={out[0][0][3]}')

if __name__ == '__main__':
    rasterize(sys.argv[1], int(sys.argv[2]), sys.argv[3])
