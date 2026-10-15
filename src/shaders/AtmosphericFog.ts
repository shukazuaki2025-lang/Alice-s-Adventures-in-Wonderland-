import * as THREE from 'three';

/**
 * Painterly aerial perspective.
 *
 * three.js fog simply mixes toward one flat colour, which on a bright day reads as grey-cream veil. A painter instead lets
 * distant things lose chroma, lighten and slip toward the cool end of the palette *before* they dissolve into the haze
 * colour (that is what gives watercolour landscapes their depth). This replaces the stock `fog_fragment` chunk so every
 * material that already supports fog (toon, lambert, basic, the grass cards ...) gets it for free - no new uniforms,
 * no extra draw calls.
 */
const FOG_FRAGMENT = /* glsl */ `
#ifdef USE_FOG

	#ifdef FOG_EXP2

		float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );

	#else

		float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );

	#endif

	{
		float fogLum = dot( gl_FragColor.rgb, vec3( 0.2126, 0.7152, 0.0722 ) );
		// chroma melts first, then the colour turns cool-violet, then it joins the haze
		vec3 farPaint = mix( gl_FragColor.rgb, vec3( fogLum ), 0.42 * fogFactor );
		farPaint *= mix( vec3( 1.0 ), vec3( 0.90, 0.95, 1.10 ), fogFactor );
		gl_FragColor.rgb = mix( farPaint, fogColor, fogFactor );
	}

#endif
`;

THREE.ShaderChunk.fog_fragment = FOG_FRAGMENT;

export {};
