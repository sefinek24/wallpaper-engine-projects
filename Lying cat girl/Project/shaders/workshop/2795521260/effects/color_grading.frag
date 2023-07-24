#include "common.h"
#include "common_blending.h"

// [COMBO] {"material":"ui_editor_properties_blend_mode","combo":"BLENDMODE","type":"imageblending","default":0}
// [COMBO] {"material":"Invert color","combo":"INVERTCOLOR","type":"options","default":0}
// [COMBO] {"material":"Invert value","combo":"INVERTVALUE","type":"options","default":0}
// [COMBO] {"material":"Adjust display gamma","combo":"GAMMA","type":"options","default":0}
// [COMBO] {"material":"Linear color space","combo":"LINEAR","type":"options","default":0}
// [COMBO] {"material":"Greyscale","combo":"GREYSCALE","type":"options","default":0}
// [COMBO] {"material":"Invert opacity mask","combo":"INVERTMASK","type":"options","default":0}
// [COMBO] {"material":"Tools","combo":"PROPERTIES","type":"options","default":0,"options":{"Brightness, contrast and saturation":0,"Exposure, black level and vibrance":1,"Hue, chroma and color filter":2,"Color temperature":3,"Split toning":4,"Lift-gamma-gain":5,"Channel mixer":6}}
// [COMBO] {"material":"Target","combo":"MODE","type":"options","default":0,"options":{"Whole image":0,"Selective color":1,"Selective hue":2,"Selective saturation":3,"Selective brightness":4}}

uniform float a_alpha; // {"material":"Opacity","default":1,"range":[0, 1]}
uniform float a_displayInitGamma; // {"material":"Initial display gamma","default":2.2,"range":[0,16]}
uniform float a_displayGamma; // {"material":"Corrected display gamma","default":2.2,"range":[0,16]}
uniform vec3 a_channelMultiplier; // {"default":"1 1 1","material":"Channel influence"}

#if PROPERTIES == 0
uniform float c_brightness; // {"material":"Brightness","default":0,"range":[-1,1]}
uniform float c_contrast; // {"material":"Contrast","default":0,"range":[-1,1]}
uniform float c_saturation; // {"material":"Saturation","default":0,"range":[-1,1]}
#endif
#if PROPERTIES == 1
uniform float c_exposure; // {"material":"Exposure","default":0,"range":[-1,1]}
uniform float c_blackLevel; // {"material":"Black level","default":0,"range":[-1,1]}
uniform float c_vibrance; // {"material":"Vibrance","default":0,"range":[-1,1]}
#endif
#if PROPERTIES == 2
uniform float c_hueShift; // {"material":"Hue shift","default":0,"range":[0,360]}
uniform float c_chroma; // {"material":"Chroma","default":0,"range":[-1,1]}
uniform vec3 c_colorFilter; // {"default":"1 1 1","material":"Color filter","type":"color"}
#endif
#if PROPERTIES == 3
uniform float c_colorTemp; // {"material":"Color temperature","default":0,"range":[-1,1]}
uniform float c_whiteTint; // {"material":"White balance tint","default":0,"range":[-1,1]}
#endif
#if PROPERTIES == 4
uniform float c_shadows; // {"material":"Shadows","default":0,"range":[-1,1]}
uniform float c_highlights; // {"material":"Highlights","default":0,"range":[-1,1]}
uniform float c_HSbalance; // {"material":"Balance","default":0,"range":[-1,1]}
uniform vec3 c_shadowTint; // {"default":"1 1 1","material":"Shadow tint","type":"color"}
uniform vec3 c_highlightTint; // {"default":"1 1 1","material":"Highlight tint","type":"color"}
#endif
#if PROPERTIES == 5
uniform float c_gamma; // {"material":"Gamma adjustment","default":0,"range":[-1,1]}
uniform float c_gain; // {"material":"Gain adjustment","default":0,"range":[-1,1]}
uniform float c_lift; // {"material":"Lift adjustment","default":0,"range":[-1,1]}
uniform vec3 c_LiftColorFilter; // {"default":"1 1 1","material":"Lift color filter","type":"color"}
uniform vec3 c_GammaColorFilter; // {"default":"1 1 1","material":"Gamma color filter","type":"color"}
uniform vec3 c_GainColorFilter; // {"default":"1 1 1","material":"Gain color filter","type":"color"}
#endif
#if PROPERTIES == 6
uniform vec3 c_red; // {"default":"1 0 0","material":"Red"}
uniform vec3 c_green; // {"default":"0 1 0","material":"Green"}
uniform vec3 c_blue; // {"default":"0 0 1","material":"Blue"}
uniform vec3 c_matrixOffset; // {"default":"0 0 0","material":"Offset"}
const mat3 colorMatrix = mat3(c_red, c_green, c_blue);
#endif
#if MODE != 0
uniform vec3 c_replaceBaseColor; // {"default":"1 1 1","material":"Base color","type":"color"}
uniform float c_tollerance; // {"material":"Tollerance","default":1,"range":[0,1]}
uniform float c_smooth; // {"material":"Smooth blending","default":1,"range":[0,1]}
#endif

uniform sampler2D g_Texture0; // {"material":"framebuffer","label":"ui_editor_properties_framebuffer","hidden":true}
uniform sampler2D g_Texture1; // {"combo":"MASK","default":"util/white","label":"ui_editor_properties_opacity_mask","material":"mask","mode":"opacitymask","paintdefaultcolor":"0 0 0 1"}

varying vec2 v_TexCoord;

#if GAMMA
#define startGamma a_displayInitGamma
#define endGamma a_displayGamma
#else
#define startGamma 2.2
#define endGamma 2.2
#endif

#define LUMINANCE_FACTOR vec3(0.2126, 0.7152, 0.0722)
#if PROPERTIES == 3
const mat3 LIN_2_LMS_MAT = mat3(
	3.90405e-1, 5.49941e-1, 8.92632e-3,
	7.08416e-2, 9.63172e-1, 1.35775e-3,
	2.31082e-2, 1.28021e-1, 9.36245e-1
);
const mat3 LMS_2_LIN_MAT = mat3(
	2.85847e+0, -1.62879e+0, -2.48910e-2,
	-2.10182e-1, 1.15820e+0, 3.24281e-4,
	-4.18120e-2, -1.18169e-1, 1.06867e+0
);
#endif

#if PROPERTIES == 1
vec3 vibrance(vec3 color){
	float luma = dot(color, LUMINANCE_FACTOR);
	float max_color = max(color.r, max(color.g, color.b));
	float min_color = min(color.r, min(color.g, color.b));
    float color_saturation = max_color - min_color;
    return mix(luma, color, (1.0 + (c_vibrance * (1.0 - (sign(c_vibrance) * color_saturation)))));
}
#endif

#if PROPERTIES == 3
vec3 whiteBalance(vec3 color) {
	float t1 = c_colorTemp * 10.0 / 6.0;
	float t2 = c_whiteTint * 10.0 / 6.0;
	float x = 0.31271 - t1 * (t1 < 0.0 ? 0.1 : 0.05);
	float standardIlluminantY = 2.87 * x - 3.0 * x * x - 0.27509507;
	float y = standardIlluminantY + t2 * 0.05;
	const vec3 w1 = vec3(0.949237, 1.03542, 1.08728);
	float X = x / y;
	float Z = (1.0 - x - y) / y;
	float L = 0.7328 * X + 0.4296 - 0.1624 * Z;
	float M = -0.7036 * X + 1.6975 + 0.0061 * Z;
	float S = 0.0030 * X + 0.0136 + 0.9834 * Z;
	vec3 w2 = vec3(L, M, S);
	vec3 balance = vec3(w1.x / w2.x, w1.y / w2.y, w1.z / w2.z);
	vec3 lms = mul(LIN_2_LMS_MAT, color);
	return mul(LMS_2_LIN_MAT, lms * balance);
}
#endif

#if PROPERTIES == 5
vec3 liftGammaGain(vec3 color) {
	color = color + (c_LiftColorFilter * (c_lift + 1.0) / 2.0 - 0.5) * (1.0 - color);
	color = saturate(color * (1.5 - 0.5 * c_LiftColorFilter * (c_lift + 1.0)) + 0.5 * c_LiftColorFilter * (c_lift + 1.0) - 0.5);
	color *= c_GainColorFilter * pow(2.0, c_gain);
	return pow(abs(color), (1.0 / c_GammaColorFilter) * pow(2.0, -c_gamma));
}
#endif

vec3 invertValue(vec3 color) {
	color = rgb2hsv(color);
	color.z = 1.0 - color.z;
	return hsv2rgb(color);
}

#if PROPERTIES == 2
vec3 hue(vec3 color) {
	const vec3 k = CAST3(0.57735);
	float cosAngle = cos(radians(c_hueShift));
	return color * cosAngle + cross(k, color) * sin(radians(c_hueShift)) + k * dot(k, color) * (1.0 - cosAngle);
}

vec3 chroma(vec3 color) {
	color = rgb2hsv(color);
	color.y += c_chroma;
	return hsv2rgb(color);
}
#endif

#if PROPERTIES == 4
vec3 splitTone(vec3 color) {
	float luma = dot(color, LUMINANCE_FACTOR);
	float t = saturate(luma + c_HSbalance);
	vec3 shadows = mix(0.5, c_shadowTint * ((1.0 + c_shadows * 1.5) / 2.0), 1.0 - t);
	vec3 highlights = mix(0.5, c_highlightTint * ((1.0 + c_highlights * 1.5) / 2.0), t);
	color = BlendSoftLight(color, shadows);
	return BlendSoftLight(color, highlights);
}
#endif

#if MODE != 0
float select(vec3 initColor, vec3 color) {
	vec3 hsv = rgb2hsv(color);
	vec3 baseColor = rgb2hsv(LINEAR ? pow(c_replaceBaseColor, startGamma) : c_replaceBaseColor);
#if MODE == 1
	float dist = min(abs(hsv.x - baseColor.x), 1.0 - abs(hsv.x - baseColor.x)) + max(abs(hsv.y - baseColor.y), 0.0) + max(abs(hsv.z - baseColor.z), 0.0);
#endif
#if MODE == 2
	float dist = min(abs(hsv.x - baseColor.x), 1.0 - abs(hsv.x - baseColor.x));
#endif
#if MODE == 3
	float dist = max(abs(hsv.y - baseColor.y), 0.0);
#endif
#if MODE == 4
	float dist = max(abs(hsv.z - baseColor.z), 0.0);
#endif
	return saturate(pow(c_tollerance / dist, 1.0 / c_smooth));
}
#endif

void main() {
	vec4 albedo = texSample2D(g_Texture0, v_TexCoord.xy);
	vec4 baseAlbedo = albedo;
	float mask = texSample2D(g_Texture1, v_TexCoord.xy).r;
#if INVERTMASK
	mask = 1.0 - mask;
#endif

	if (mask > 0.0 && a_alpha > 0.0){
#if LINEAR
		albedo.rgb = pow(albedo.rgb, startGamma);
		baseAlbedo.rgb = pow(baseAlbedo.rgb, startGamma);
#endif
#if GREYSCALE
		albedo.rgb = greyscale(albedo.rgb);
#endif
#if INVERTCOLOR
		albedo.rgb = 1.0 - albedo.rgb;
#endif
#if INVERTVALUE
		albedo.rgb = invertValue(albedo.rgb);
#endif

#if MODE != 0
		float colorMultiplier = select(baseAlbedo, albedo);
#else
		float colorMultiplier = 1.0;
#endif

#if PROPERTIES == 0
		albedo.rgb = ContrastSaturationBrightness(albedo.rgb, 1.0 + c_brightness, 1.0 + c_saturation, 1.0 + c_contrast);
		albedo.rgb = mix(baseAlbedo.rgb, albedo.rgb, a_channelMultiplier * colorMultiplier * mask * a_alpha);
#endif
#if PROPERTIES == 1
		if (c_exposure != 0.0) albedo.rgb *= pow(2.0, c_exposure);
		if (c_vibrance != 0.0) albedo.rgb = vibrance(albedo.rgb);
		if (c_blackLevel != 0.0) albedo.rgb -= c_blackLevel / 10.0;
		albedo.rgb = mix(baseAlbedo.rgb, albedo.rgb, a_channelMultiplier * colorMultiplier * mask * a_alpha);
#endif
#if PROPERTIES == 2
		albedo.rgb *= c_colorFilter;
		if (c_hueShift != 0.0) albedo.rgb = hue(albedo.rgb);
		if (c_chroma != 0.0) albedo.rgb = chroma(albedo.rgb);
		albedo.rgb = mix(baseAlbedo.rgb, albedo.rgb, a_channelMultiplier * colorMultiplier * mask * a_alpha);
#endif
#if PROPERTIES == 3
		albedo.rgb = whiteBalance(albedo.rgb);
		albedo.rgb = mix(baseAlbedo.rgb, albedo.rgb, colorMultiplier * mask * a_alpha);
#endif
#if PROPERTIES == 4
		albedo.rgb = splitTone(albedo.rgb);
		albedo.rgb = mix(baseAlbedo.rgb, albedo.rgb, a_channelMultiplier * colorMultiplier * mask * a_alpha);
#endif
#if PROPERTIES == 5
		albedo.rgb = liftGammaGain(albedo.rgb);
		albedo.rgb = mix(baseAlbedo.rgb, albedo.rgb, a_channelMultiplier * colorMultiplier * mask * a_alpha);
#endif
#if PROPERTIES == 6
		albedo.rgb = mul(albedo.rgb, colorMatrix) + c_matrixOffset;
		albedo.rgb = mix(baseAlbedo.rgb, albedo.rgb, colorMultiplier * mask * a_alpha);
#endif

#if LINEAR
		albedo.rgb = pow(albedo.rgb, 1.0 / startGamma);
		baseAlbedo.rgb = pow(baseAlbedo.rgb, 1.0 / startGamma);
#endif

		albedo.rgb = ApplyBlending(BLENDMODE, baseAlbedo.rgb, albedo.rgb, mask * albedo.a * a_alpha);
		albedo.rgb = pow(albedo.rgb, 2.2 / endGamma);
	}

	gl_FragColor = albedo;
}