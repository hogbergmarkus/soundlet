import Adw from 'gi://Adw';
import GIRepository from 'gi://GIRepository?version=3.0';
import GLib from 'gi://GLib';
import Gtk from 'gi://Gtk';
import {ExtensionPreferences, gettext as _} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';
import {availableOutputs, watchOutputs} from './outputs.js';

export default class SoundletPreferences extends ExtensionPreferences {
    async fillPreferencesWindow(window) {
        // Ubuntu ships Gvc next to libgvc in GNOME Shell's private library path.
        GIRepository.Repository.dup_default().prepend_search_path(imports.package.pkglibdir);
        const {default: Gvc} = await import('gi://Gvc');
        const control = new Gvc.MixerControl({name: 'Soundlet Preferences'});
        const settings = this.getSettings();
        const page = new Adw.PreferencesPage();
        const group = new Adw.PreferencesGroup({title: _('Audio outputs'),
            description: _('Choose two different outputs to enable switching.')});
        window.add(page);
        page.add(group);
        let updating = false;
        const choices = ['output-a', 'output-b'].map((key, i) => {
            const row = new Adw.ComboRow({title: i ? _('Output B — Headphones') : _('Output A — Speakers')});
            group.add(row);
            const choice = {row, key, entries: []};
            row.connect('notify::selected', () => {
                const entry = choice.entries[row.selected];
                if (!updating && entry)
                    settings.set_value(key, new GLib.Variant('(ss)', [entry.name, entry.port]));
            });
            return choice;
        });
        function refresh() {
            const outputs = control.get_state() === Gvc.MixerControlState.READY
                ? availableOutputs(control).sort((a, b) => a.label.localeCompare(b.label)) : [];
            updating = true;
            try {
                for (const choice of choices) {
                    const [name, port] = settings.get_value(choice.key).deepUnpack();
                    const entries = [{name: '', port: '', label: _('Not selected')}, ...outputs];
                    let index = entries.findIndex(o => o.name === name && o.port === port);
                    if (index < 0) {
                        entries.push({name, port, label: _('Unavailable — %s').format([name, port].filter(Boolean).join(' / '))});
                        index = entries.length - 1;
                    }
                    choice.entries = entries;
                    choice.row.model = Gtk.StringList.new(entries.map(o => o.label));
                    choice.row.selected = index;
                }
            } finally {
                updating = false;
            }
        }
        const unwatch = watchOutputs(control, refresh);
        // A row can write GSettings during GTK list activation. Keep its model
        // alive until GTK has finished dispatching that activation.
        let refreshId = 0;
        const changed = settings.connect('changed', () => {
            if (!refreshId) {
                refreshId = GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
                    refreshId = 0;
                    refresh();
                    return GLib.SOURCE_REMOVE;
                });
            }
        });
        window.connect('close-request', () => {
            unwatch();
            settings.disconnect(changed);
            if (refreshId)
                GLib.Source.remove(refreshId);
            control.close();
            return false;
        });
        refresh();
        control.open();
    }
}
