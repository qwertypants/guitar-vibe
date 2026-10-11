config.define_string('runtime', usage='native (default on Mac) or container')
args = config.parse()
runtime = args.get('runtime', os.getenv('OLLAMA_RUNTIME', 'native'))
if runtime not in ['native', 'container']:
    fail('runtime must be native or container')

files = ['compose.yml']
if runtime == 'native':
    files.append('compose.native.yml')
docker_compose(files, project_name='guitar-vibe-dev')
docker_prune_settings(disable=True)

compose = ['docker', 'compose', '--project-name', 'guitar-vibe-dev']
for file in files:
    compose.extend(['-f', file])

local_resource(
    'model-prepare',
    cmd=compose + ['run', '--rm', '--no-deps', 'model-prepare'],
    deps=['scripts/check-model.mjs'],
    resource_deps=['ollama'] if runtime == 'container' else [],
)
dc_resource('app', resource_deps=['model-prepare'], links=['http://localhost:' + os.getenv('APP_PORT', '3000')])

eval_args = ['--runs', '3', '--out', 'evals/output/tilt.json']
if runtime == 'container':
    eval_args = ['--models', 'qwen2.5:0.5b-instruct-q4_K_M,qwen2.5:1.5b-instruct-q4_K_M,qwen3:4b-q4_K_M,granite4:micro'] + eval_args

local_resource(
    'eval-models',
    cmd=compose + ['run', '--rm', '--no-deps', 'app', 'npm', 'run', 'eval:models', '--'] + eval_args,
    resource_deps=['model-prepare'],
    trigger_mode=TRIGGER_MODE_MANUAL,
    auto_init=False,
)
