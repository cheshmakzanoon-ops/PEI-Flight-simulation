"""Add one authored view moment to the exact expanded radiance program."""
import hashlib
import json
import sys

packet = json.load(sys.stdin)
program = packet["shader"]
vertex, fragment = program["vertex"], program["fragment"]
main = "void main(){"
colour = "gl_FragColor=vec4(c,1.);"
if vertex.count(main) != 1 or fragment.count(main) != 1 or fragment.count(colour) != 1:
    raise ValueError("the authorised near-only source program differs")
program["vertex"] = vertex.replace(
    main, "centroid out float atlasEyeDepth;\n" + main
    + "\n atlasEyeDepth=-(modelViewMatrix*vec4(position,1.)).z;")
program["fragment"] = fragment.replace(
    main, "centroid in float atlasEyeDepth;\n" + main
).replace(
    colour, "float pageDepth=clamp((atlasEyeDepth-7.4)/5.2,0.,1.);"
    "gl_FragColor=vec4(pageDepth,c.r,c.g,1.);")
packet["linkedSourceSHA256"] = {
    key: hashlib.sha256(value.encode()).hexdigest() for key, value in program.items()
}
print(json.dumps(packet, separators=(",", ":")))
