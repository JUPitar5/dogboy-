import urllib.request, re, json, os, concurrent.futures, sys
from html.parser import HTMLParser
from PIL import Image
from io import BytesIO

BASE = 'https://www.theboringblog.ai'
def read(path):
    return urllib.request.urlopen(BASE + path, timeout=60).read()
def save(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'wb') as f: f.write(data)

# Isolate the public landscape renderer from its original framework runtime.
core = read('/_next/static/chunks/0mcpcz1rq6ljb.js').decode()
scene = read('/_next/static/chunks/23tft18o9t3ud.js').decode()
def unwrap(text):
    start = text.index('e=>{') + len('e=>{')
    return text[start:text.rfind('}]);')]
core_body = unwrap(core)
scene_body = unwrap(scene)
scene_body = re.sub(r'let o=\[.*?\],i=matchMedia', 'let o=scenes,i=matchMedia', scene_body, count=1, flags=re.S)
scene_body = scene_body.replace('blades:22e4', 'blades:45000').replace('Math.min(devicePixelRatio,2)', 'Math.min(devicePixelRatio,1.5)')
scene_body = scene_body.replace('`/art/situations/${e.src}`', '`/art/situations/${e.src.replace(".png",".webp")}`')
scene_body = scene_body.replace('r.REDUCED||g.querySelector(".reader")', 'true')
scene_body = scene_body.replace('x.setPixelRatio(Math.min(devicePixelRatio,1.5));', 'x.setPixelRatio(Math.min(devicePixelRatio,1.5));{const gl=x.getContext(),info=gl.getExtension("WEBGL_debug_renderer_info"),software=info&&/swiftshader|llvmpipe|software/i.test(gl.getParameter(info.UNMASKED_RENDERER_WEBGL));if(software){b.grass.blades=6000;x.setPixelRatio(.8)}}')
scene_body = scene_body.replace('if(x.render(E,U.camera),M.uTime.value-e1>.2)', 'if(!g.classList.contains("is-reading")&&x.render(E,U.camera),!g.classList.contains("is-reading")&&M.uTime.value-e1>.2)')
# Keep the original visual composition, with bounded geometry and local assets.
save('public/field/engine.js', ('/* Landscape rendering engine adapted from the user-supplied reference; includes Three.js (MIT). */\nexport function register(e){'+core_body+'}\n').encode())
save('public/field/clearing.js', ('/* Interactive meadow adapted from the user-supplied reference. Scene content is supplied by the application database. */\nexport function register(e,scenes){'+scene_body+'}\n').encode())
if '--renderer-only' in sys.argv:
    print('Updated landscape renderer.')
    sys.exit(0)
fonts = {
 'fraunces.woff2':'54fc36028e2bb174-s.p.20jfceqj9zyw9.woff2',
 'fraunces-italic.woff2':'66b33cc02d8f8b9d-s.p.3slq8sz4zhb1g.woff2',
 'geist.woff2':'Geist_Variable-s.p.0mrjj4bg00-he.woff2'
}
for name, source in fonts.items(): save('public/fonts/'+name, read('/_next/static/media/'+source))
image=Image.open(BytesIO(read('/sky/dawn.png')))
os.makedirs('public/images',exist_ok=True)
image.convert('RGB').save('public/images/dawn.webp',quality=86)
assets = re.findall(r'src:"([a-z-]+v1\.png)"', scene)
def download_asset(name):
    destination='public/art/situations/'+name.replace('.png','.webp')
    os.makedirs(os.path.dirname(destination), exist_ok=True)
    source='public/art/situations/'+name
    data=open(source,'rb').read() if os.path.exists(source) else read('/art/situations/'+name)
    Image.open(BytesIO(data)).convert('RGB').save(destination, quality=88, method=6)
with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool: list(pool.map(download_asset,assets))
image=Image.open('public/art/situations/creative-break-v1.webp').convert('RGBA')
pixels=image.load()
for y in range(image.height):
    for x in range(image.width):
        r,g,b,a=pixels[x,y]
        if r>140 and b>140 and g<100 and min(r,b)-g>90: pixels[x,y]=(r,g,b,0)
image.save('public/images/creative-break.webp',quality=90)
for name in assets:
    path='public/art/situations/'+name
    if os.path.exists(path): os.remove(path)

class StoryParser(HTMLParser):
    def __init__(self):
        super().__init__(); self.sections=[]; self.current=None; self.depth=0; self.capture=None; self.buffer=[]; self.ignore=0
    def handle_starttag(self,tag,attrs):
        attrs=dict(attrs); cls=attrs.get('class','')
        if tag=='section' and 'story__beat' in cls and 'story__beat--title' not in cls:
            self.current={'heading':'','paragraphs':[]};self.depth=1
        elif self.current is not None:
            if tag=='section':self.depth+=1
            if tag=='h2' and 'story__heading' in cls:self.capture='heading';self.buffer=[]
            elif tag in ('p','li','blockquote') and not self.capture:
                if any(s in cls for s in ('story__count','story__listenHere','story__meta','end__','demo__caption')):return
                self.capture=tag;self.buffer=[]
            elif tag=='br' and self.capture:self.buffer.append('\n')
    def handle_data(self,text):
        if self.capture:self.buffer.append(text)
    def handle_endtag(self,tag):
        if self.current is None:return
        if self.capture and (tag==self.capture or self.capture=='heading' and tag=='h2'):
            text=' '.join(''.join(self.buffer).split())
            if text:
                if self.capture=='heading':self.current['heading']=text
                else:self.current['paragraphs'].append(text)
            self.capture=None;self.buffer=[]
        if tag=='section':
            self.depth-=1
            if self.depth==0:
                if self.current['paragraphs']:self.sections.append(self.current)
                self.current=None;self.capture=None
slugs=re.findall(r'<link>'+re.escape(BASE)+r'/posts/([^<]+)</link>',read('/feed.xml').decode())
def get_article(slug):
    parser=StoryParser();parser.feed(read('/posts/'+slug).decode())
    sections=[s for s in parser.sections if s['heading'] or len(' '.join(s['paragraphs']))>150]
    # Preserve readable beats even where the reference places a long discussion in one chapter.
    result=[]
    for section in sections:
        paragraphs=[];length=0;part=0
        for p in section['paragraphs']:
            if length+len(p)>2300 and paragraphs:
                result.append({'heading':section['heading'] if part==0 else section['heading']+' (continued)','paragraphs':paragraphs})
                paragraphs=[];length=0;part+=1
            paragraphs.append(p);length+=len(p)
        if paragraphs:result.append({'heading':section['heading'] if part==0 else section['heading']+' (continued)','paragraphs':paragraphs})
    return {'slug':slug,'content':result}
with concurrent.futures.ThreadPoolExecutor(max_workers=5) as pool: articles=list(pool.map(get_article,slugs))
save('.reference/articles.json',json.dumps(articles,ensure_ascii=False).encode())
print('Downloaded fonts, sky, %s illustrations and %s articles.'%(len(assets),len(articles)))
for item in articles:print(item['slug'],len(item['content']),'sections')
