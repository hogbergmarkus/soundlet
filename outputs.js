import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

export function availableOutputs(control) {
    const outputs = [];
    for (const sink of control.get_sinks()) {
        const name = sink.get_name();
        const label = sink.get_description() || name;
        const ports = sink.get_ports();
        if (!ports.length) {
            outputs.push({name, port: '', label, sink});
            continue;
        }

        // Card jack availability can change after the stream ports were created.
        const cardPorts = control.lookup_card_id(sink.get_card_index())?.get_ports() ?? [];
        for (const port of ports) {
            const jack = cardPorts.find(p => p.port === port.port);
            // PulseAudio card availability: 0 unknown, 1 no, 2 yes.
            if (jack ? jack.available === 1 : !port.available)
                continue;
            outputs.push({name, port: port.port, label: `${port.human_port} — ${label}`, sink});
        }
    }
    return outputs;
}

export function selection(control, settings) {
    const outputs = availableOutputs(control);
    const current = control.get_default_sink();
    const port = current?.get_ports().length ? current.get_port()?.port : '';
    const [a, b] = ['output-a', 'output-b'].map(key => {
        const [name, savedPort] = settings.get_value(key).deepUnpack();
        return outputs.find(o => o.name === name && o.port === savedPort);
    });
    const matches = o => o && o.sink === current && o.port === port;
    const role = a === b ? null : matches(a) ? 'a' : matches(b) ? 'b' : null;
    return {role, target: current && a && b && a !== b ? (role === 'a' ? b : a) : null};
}

// Gvc can emit several signals during one update. Read the settled state at idle.
export function watchOutputs(control, refresh) {
    let idle = 0;
    let sink = null;
    let portSignal = 0;
    function schedule() {
        if (idle)
            return;
        idle = GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
            idle = 0;
            const current = control.get_default_sink();
            if (current !== sink) {
                if (portSignal)
                    sink.disconnect(portSignal);
                sink = current;
                portSignal = sink?.connect('notify::port', schedule) ?? 0;
            }
            refresh();
            return GLib.SOURCE_REMOVE;
        });
    }
    const signals = ['state-changed', 'default-sink-changed', 'active-output-update',
        'output-added', 'output-removed', 'stream-added', 'stream-removed', 'card-added',
        'card-removed'].map(signal => control.connect(signal, schedule));
    schedule();
    return () => {
        for (const id of signals)
            control.disconnect(id);
        if (portSignal)
            sink.disconnect(portSignal);
        if (idle)
            GLib.Source.remove(idle);
    };
}

export function switchOutput(control, target) {
    if (target.port && target.sink.get_port()?.port !== target.port &&
        !target.sink.change_port(target.port))
        throw new Error('Port change failed');

    if (target.sink === control.get_default_sink())
        return null;

    // Set only WirePlumber's preferred playback node. Its linking policy
    // owns live stream moves and honors separately routed applications.
    return Gio.Subprocess.new(['pw-metadata', '-n', 'default', '0',
        'default.configured.audio.sink', JSON.stringify({name: target.name}),
        'Spa:String:JSON'], Gio.SubprocessFlags.STDOUT_SILENCE);
}
