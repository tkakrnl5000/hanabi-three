import {test,expect} from '@playwright/test';
test('PC·모바일 규칙 도움말: 포커스 순환·Escape·스크롤 잠금·포커스 복구',async({browser})=>{
 for(const viewport of [{width:1440,height:1000},{width:390,height:844}]){
  const context=await browser.newContext({viewport});const page=await context.newPage();
  try{
   await page.goto('/');const opener=page.getByRole('button',{name:'게임 방법'});await opener.click();const dialog=page.getByRole('dialog',{name:'게임 방법'}),close=dialog.getByRole('button',{name:'닫기'}),link=dialog.getByRole('link',{name:'공식 영문 룰북'});
   await expect(close).toBeFocused();expect(await page.evaluate(()=>document.body.style.overflow)).toBe('hidden');
   await page.keyboard.press('Shift+Tab');await expect(link).toBeFocused();await page.keyboard.press('Tab');await expect(close).toBeFocused();
   await page.screenshot({path:`test-results/rules-${viewport.width}.png`});await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);await expect(opener).toBeFocused();expect(await page.evaluate(()=>document.body.style.overflow)).not.toBe('hidden');
   await opener.click();await close.click();await expect(opener).toBeFocused();
  }finally{await context.close();}
 }
});

test('만료된 방 복구 실패 후 새 방 생성 가능',async({page})=>{
 await page.addInitScript(()=>{localStorage.setItem('hanabi-seat-FAKE22','a'.repeat(64));localStorage.setItem('hanabi-name','복구');});
 await page.goto('/?room=FAKE22');await expect(page.getByRole('status')).toContainText('존재하지 않거나 만료된 방');const create=page.getByRole('button',{name:'새 방 만들기'});await expect(create).toBeEnabled();await create.click();await expect(page.getByTestId('room-code')).toHaveText(/^[A-Z2-9]{6}$/);
});
