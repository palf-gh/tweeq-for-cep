import vue from '@vitejs/plugin-vue'
import {resolve} from 'path'
import {defineConfig} from 'vite'
import dts from 'vite-plugin-dts'
// https://vitejs.dev/config/
export default defineConfig(({mode}) => {
	return {
		plugins: [vue(), dts({tsconfigPath: './tsconfig.build.json'})],
		publicDir: mode === 'development' ? undefined : false,
		build: {
			lib: {
				name: 'Tweeq',
				entry: resolve(__dirname, 'src/index.ts'),
				fileName: format => `index.${format}.js`,
			},
			outDir: 'lib',
			rollupOptions: {
				external: ['vue'],
				output: {
					globals: {
						vue: 'Vue',
					},
				},
			},
		},
		ssr: {
			noExternal: ['@baku89/pave'],
			external: ['paper', 'paper-jsdom-canvas'],
		},
	}
})
