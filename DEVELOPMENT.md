# Development

## Audio and Shell integration

The panel uses the shared `getMixerControl()` from GNOME Shell 51's volume module. Preferences opens a separate Gvc connection for the lifetime of its GTK4/libadwaita window. Both read sinks and active-profile ports from Gvc. An empty port represents a portless sink. The two GSettings keys contain string pairs of sink name and port name. Runtime object IDs never enter the configuration.

Gvc signals schedule a coalesced refresh after the mixer finishes its update. The default sink also supplies port notifications. Gvc handles server reconnection. During teardown the extension detaches its listeners, removes pending idle work and destroys the panel actor. The Shell retains ownership of the shared mixer.

A click resolves both selections again. If needed, Gvc requests a port change. For a different sink, one asynchronous `pw-metadata` process writes the selected node name to WirePlumber's `default.configured.audio.sink` key. Subject zero addresses server-wide metadata. WirePlumber chooses the available default and applies its existing stream policy. The icon follows the default reported back by Gvc. Soundlet issues no per-stream move, volume, input, or profile commands. Gvc's alternative default-sink setter also rewrites PulseAudio stream-restore entries, which is why this build uses the narrower metadata operation. [Gvc implementation](https://github.com/GNOME/libgnome-volume-control/blob/master/gvc-mixer-control.c)

## Build and inspect

Build dependencies are GNOME's extension CLI, GLib schema tools, Python 3, and either gettext's msgfmt or Babel's pybabel. Run:

```sh
./pack.sh
unzip -t dist/*.shell-extension.zip
sha256sum dist/*.shell-extension.zip
```

The script stages the extension, compiles Swedish messages, validates the schema and runs `gnome-extensions pack`. It normalizes ZIP order, permissions and timestamps. Rebuilds with the same tools and sources should have the same SHA-256 hash. The installer compiles the schema at installation. To update translations with GNU gettext:

```sh
xgettext --language=JavaScript --from-code=UTF-8 --keyword=_ -o build/soundlet.pot extension.js prefs.js
msgmerge --update po/sv.po build/soundlet.pot
```

To check installation independently of your profile:

```sh
stage=$(mktemp -d)
mkdir -p "$stage/cache" "$stage/data/gnome-shell/extensions"
XDG_CACHE_HOME="$stage/cache" XDG_DATA_HOME="$stage/data" gnome-extensions install --print-uuid dist/*.shell-extension.zip
```

## Test on GNOME 51

1. Note the current output in Settings → Sound. Install and enable Soundlet as described in the README. Check for one neutral icon on the right and confirm the original default is still selected.
2. Open Soundlet preferences. Select speakers for A and headphones for B. Leave a third output such as HDMI unassigned.
3. Play continuous audio in Brave. Click the button twice, pausing between clicks. For each click check the icon, the audible output, Settings → Sound and the stream links in `wpctl status -n`. Compare volume and mute on each device before and after.
4. Select each output using GNOME's own controls. The icon should follow. Select HDMI in GNOME. Expect a neutral icon, then A on the next click. If another app has a stream routed specifically to HDMI, check that it stays there.
5. Unplug the USB dongle, try the button, then reconnect. Expect switching to be unavailable while the pair is incomplete. Check that the saved B reappears and that the next valid click works. The session manager may itself change the default during hotplug.
6. Disable and enable Soundlet several times. Verify a single icon and a single action per click. Log out and in manually. Confirm A and B in Preferences. After a normal audio service restart, verify the same behavior once devices return.
7. Inspect the user journal for errors while repeating the checks.

```sh
gnome-extensions info soundlet@hogbergmarkus.github.io
wpctl status -n
wpctl settings linking.follow-default-target
journalctl --user -b _COMM=gnome-shell --no-pager | rg -i 'soundlet|js error'
```

Changing a device profile can change its sink name and require selecting it again.

## Validation for 0.1.0

Desktop tests passed on Ubuntu 26.10 with GNOME Shell 51.0, PipeWire 1.6.8 and WirePlumber 0.5.17. A panel click switched outputs and moved active audio. Changing the default externally updated the icon. Disconnecting and reconnecting the HyperX USB dongle restored switching. Both choices were saved in GSettings, and selecting them in Preferences completed without a crash.

The preferences regression test exercised both combo rows across three window lifetimes, including an external settings change and closing with an update pending. GSettings writes take effect immediately. Model refreshes run at idle so GTK can finish handling the selection first.

In an isolated WirePlumber session, a stream following the default moved from virtual speakers to virtual headphones while another stream explicitly routed to virtual HDMI stayed there.
