import asyncio,json,mimetypes,os
from pathlib import Path
from urllib.parse import urlparse,parse_qs
from playwright.async_api import async_playwright

ROOT=Path.cwd()
async def main():
 async with async_playwright() as p:
  browser=await p.chromium.launch(headless=True,args=['--no-sandbox','--enable-unsafe-swiftshader','--disable-dev-shm-usage'])
  context=await browser.new_context(viewport={'width':1280,'height':800},device_scale_factor=1)
  async def route(request):
   url=urlparse(request.request.url)
   if url.path.startswith('/api/'):
    data={'resource':url.path.split('/')[-1],'method':request.request.method,'query':{k:v[0] for k,v in parse_qs(url.query).items()},'body':json.loads(request.request.post_data or '{}')}
    process=await asyncio.create_subprocess_exec('node','tools/test-api.mjs',json.dumps(data),stdout=asyncio.subprocess.PIPE,stderr=asyncio.subprocess.PIPE)
    stdout,stderr=await process.communicate()
    try:
     result=json.loads(stdout)
     await request.fulfill(status=result['status'],content_type='application/json',body=json.dumps(result['data']))
    except Exception:
     print('API ERROR',stderr.decode());await request.fulfill(status=500,body='{}')
   else:
    path=ROOT/'dist'/url.path.lstrip('/')
    if not path.is_file():path=ROOT/'dist/index.html'
    content_type=mimetypes.guess_type(str(path))[0] or 'application/octet-stream'
    await request.fulfill(status=200,content_type=content_type,body=path.read_bytes())
  await context.route('**/*',route)
  page=await context.new_page()
  errors=[]
  page.on('pageerror',lambda error:errors.append(str(error)))
  page.on('console',lambda msg: print('CONSOLE',msg.text[:400]) if msg.type=='error' else None)
  await page.goto('http://boring.local/',wait_until='networkidle',timeout=90000)
  await page.wait_for_timeout(8500)
  print('Home:',await page.locator('h1').inner_text())
  print('Canvas:',await page.locator('canvas').count(),'Fallback:',await page.locator('.fallback-art').count())
  await page.screenshot(path='.reference/recreation-desktop.png',timeout=60000)
  await page.get_by_role('button',name='Turn right',exact=True).click()
  await page.wait_for_timeout(1200)
  print('Scene position:',await page.get_by_role('slider').get_attribute('aria-valuenow'))
  await page.get_by_role('button',name='Put the sun down').click()
  await page.wait_for_timeout(1200)
  print('Night:',await page.locator('html').get_attribute('class'))
  await page.screenshot(path='.reference/recreation-night.png',timeout=60000)
  await page.get_by_role('button',name='Bring the sun up').click()
  await page.get_by_role('button',name='Subscribe',exact=True).click()
  await page.get_by_role('textbox',name='Email address').fill('browser-qa@example.com')
  await page.get_by_role('button',name='Join',exact=True).click()
  await page.get_by_text('A little less noise.').wait_for(timeout=20000)
  print('Subscribe successful')
  await page.get_by_role('button',name='Unsubscribe in one click').click()
  await page.get_by_role('button',name='Join',exact=True).wait_for(timeout=20000)
  print('Unsubscribe successful')
  await page.get_by_role('button',name='Close subscription').click()
  await page.get_by_role('link',name='Read the blog',exact=True).click()
  await page.wait_for_timeout(1000)
  print('Articles:',await page.locator('.reader__row').count())
  await page.screenshot(path='.reference/recreation-posts.png',timeout=60000)
  await page.locator('.reader__row').first.click()
  await page.locator('.story__title').wait_for(timeout=30000)
  print('Article sections:',await page.locator('.story__beat').count())
  await page.screenshot(path='.reference/recreation-article.png',timeout=60000)
  await page.get_by_role('link',name='All posts',exact=True).click()
  await page.get_by_role('link',name='Back to the field',exact=True).click()
  await page.wait_for_timeout(1000)
  print('Return home successful')
  await page.set_viewport_size({'width':390,'height':844})
  await page.wait_for_timeout(1500)
  await page.screenshot(path='.reference/recreation-mobile.png',timeout=60000)
  print('Mobile overflow:',await page.evaluate('document.documentElement.scrollWidth > window.innerWidth'))
  print('BROWSER ERRORS:',errors)
  await browser.close()
asyncio.run(main())
