import {it,expect} from 'vitest';
import {rtcMode,rtcModes} from '../src/rtc-mode.js';
it('maps only the two supported environment vocabularies without cross-environment coercion',()=>{
 for(const mode of ['test','preview'])expect(rtcMode(mode)).toBe('test');
 for(const mode of ['live','production'])expect(rtcMode(mode)).toBe('live');
 for(const mode of [undefined,'LIVE','sandbox',{},'test production'])expect(()=>rtcMode(mode)).toThrow();
 expect(rtcModes(['preview','production'])).toEqual(['test','live']);
 for(const modes of [[],['test','preview'],['live','production'],['unknown'],['test','test']])expect(()=>rtcModes(modes)).toThrow();
});
