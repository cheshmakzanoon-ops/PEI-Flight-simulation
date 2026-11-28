"""A synthetic LAS format-6 fixture; never opens provider data or a Z field."""
import io,struct
import laspy,lazrs,numpy as np
synthetic=[(473097001,513960012,1921,9,0x11,0x00,6,0,-120,18,180.051),
 (473097006,513960023,9891,9,0x21,0x20,7,0,341,23,202.412),
 (473097030,513960032,31124,9,0x11,0x00,6,0,-190,18,180.054),
 (473097050,513960054,21055,9,0x32,0x20,2,0,160,23,202.418)]
vlr=lazrs.LazVlr.new_for_compression(6,0,True)
s=io.BytesIO();codec=lazrs.LasZipCompressor(s,vlr);codec.reserve_offset_to_chunk_table()
row=b''.join(struct.pack('<iiiHBBBBhHd',*p) for p in synthetic)
codec.compress_many(np.frombuffer(row,np.uint8));codec.done()
b=s.getvalue();end=struct.unpack_from('<q',b,0)[0];data=b[8:end]
assert end>8
D=laspy.DecompressionSelection
lane=D.base()|D.CLASSIFICATION|D.FLAGS|D.SCAN_ANGLE|D.POINT_SOURCE_ID|D.GPS_TIME
assert not lane&D.Z
out=np.zeros(len(row),dtype=np.uint8)
lazrs.decompress_points_with_chunk_table(np.frombuffer(data,np.uint8),vlr.record_data(),out,[(4,len(data))],lane.to_lazrs())
t=np.dtype({'names':['X','Y','return_bits','flag_bits','classification','scan_angle','point_source_id','gps_time'],
 'formats':['<i4','<i4','u1','u1','u1','<i2','<u2','<f8'],'offsets':[0,4,14,15,16,18,20,22],'itemsize':30})
expected=[(x,y,ret,flags,cls,ang,src,gps) for x,y,_,__,ret,flags,cls,___,ang,src,gps in synthetic]
assert out.view(t).tolist()==expected
print('Pass: eight selected LAS format-6 dimensions from four synthetic points; no Z field.')
