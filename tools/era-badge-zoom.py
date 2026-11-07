#!/usr/bin/env python3
"""Nearest-neighbor zooms of actual repository browser screenshots, not new art."""
from pathlib import Path
from PIL import Image
out=Path('/workspace/xcpets/previews/era-badge')
im=Image.open(out/'era-icons-native.png').convert('RGB');border=(114,217,220)
y=next(y for y in range(im.height) if sum(im.getpixel((x,y))==border for x in range(im.width))>100)
runs=[];start=None
for x in range(im.width+1):
    hit=x<im.width and im.getpixel((x,y))==border
    if hit and start is None:start=x
    if not hit and start is not None:
        if x-start>30:runs.append((start,x))
        start=None
assert len(runs)==6,'six canonical community portraits expected in real fixture'
for name,(left,right) in zip(['nakamoto','wizard','kek','funtrump','homer','rabbit'],runs):
    bottom=max(yy for yy in range(y,im.height) if im.getpixel((left,yy))==border)
    crop=im.crop((left-3,y-3,right+4,bottom+5))
    crop.resize((crop.width*6,crop.height*6),Image.Resampling.NEAREST).save(out/('era-icon-'+name+'-zoom.png'))
for width in [1280,390]:
    crop=Image.open(out/('era-icon-crop-pet-card-'+str(width)+'.png'))
    crop.resize((crop.width*6,crop.height*6),Image.Resampling.NEAREST).save(out/('era-icon-card-zoom-'+str(width)+'.png'))
print('Saved 6 individual era zooms plus desktop/mobile actual-card zooms.')
