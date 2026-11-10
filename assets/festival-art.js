/* Runtime atlas slicing keeps the original generated artwork intact. */
window.FestivalArt = {
  tiles: {man:[0,0,300],woman:[1,0,300],grandpa:[2,0,300],granny:[0,1,300],boy:[1,1,280],girl:[2,1,280],lotus:[0,0,320],petal:[1,0,140],bell:[2,0,320],tree:[0,1,520],blossom:[1,1,320],incense:[2,1,300]},
  prepare(image,key){image.festivalTile=this.tiles[key]||null;return image;},
  draw(ctx,image,x,y,scale,anchorY=1){
    if(!image?.naturalWidth)return;
    const tile=image.festivalTile;
    if(!tile){const w=image.naturalWidth*scale,h=image.naturalHeight*scale;ctx.drawImage(image,x-w/2,y-h*anchorY,w,h);return;}
    const [col,row,size]=tile,sw=image.naturalWidth/3,sh=image.naturalHeight/2,w=size*scale,h=w;
    ctx.drawImage(image,col*sw,row*sh,sw,sh,x-w/2,y-h*anchorY,w,h);
  }
};
