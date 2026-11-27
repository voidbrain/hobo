# Places and trips manual checks

These checks use the local Hobo app and a neutral test place. Keep both processes running in separate terminals.

```sh
npm run server
```

Expected: the terminal prints `Hobo server on http://127.0.0.1:4310`.

```sh
npm start
```

Expected: Angular serves the app at `http://localhost:4200` and proxies `/api` to the local service.

## F-002-T02 — Place list and form

1. Open `http://localhost:4200/places` and choose **Add place**.
2. Leave every field blank except **Name**; enter `Test place 01` and choose **Save place**.
3. Confirm the place appears in the list. Choose **Edit Test place 01**.
4. Enter a description, category `Test`, tags `day trip, lake`, notes `Manual check`, and choose **2 h** for time on site. Save.
5. Reload the page, edit the place again, and confirm those values remain. Confirm the list shows the description, category and tags.
6. Repeat with the keyboard: tab to **Add place**, submit an empty form, and confirm the name field has an invalid state and the required-name error is announced with the danger colour and icon; the form remains open. Enter a name and save; confirm focus can reach the edit button and all fields.

Expected: a name alone creates a place; optional fields save and reload; the name is required; keyboard users can operate the form and receive the validation error.

## F-002-T04 — Place location

1. Ensure `server/config.local.json` exists. If it does not, copy `server/config.example.json` to that path; set `openRouteServiceApiKey` to your OpenRouteService key and restart the server. The file is git-ignored. OSRM does not support place search.
2. To check the missing-key guidance, temporarily leave `openRouteServiceApiKey` empty and restart the server. Search for `Treviso` and confirm the message says place search needs an OpenRouteService key and points to the local config and README. Restore the key and restart the server.
3. Edit `Test place 01` and enter `Treviso` in **Search for a place**. With the keyboard, choose a result and confirm focus returns to search and the selected coordinates are announced.
4. Save, reload the page, and edit the place again. Confirm the marker and coordinates remain.
5. On the untouched world view, choose **Use map centre** with the keyboard. Confirm no location is selected and the message says to zoom in to a local area first. Zoom to level 10 or closer and choose the button again; confirm the marker moves and the selected coordinates change. Save and reload once more. A pointer click on another map point should also update the marker and coordinates.

Expected: autocomplete suggestions come from OpenRouteService, the missing-key message identifies the setting to configure, a result or map click sets the place location, and the selected coordinates persist. The map-centre control refuses world-scale coordinates until zoom level 10.

## F-002-T05 — Categories and tags

1. Create or edit three test places: set two to category `Culture`, give one of those the tags `family, outdoors`, give the other `museum`, and leave the third without a category or tags.
2. Set **Category** to `Culture` and **Tag** to `family`. Confirm only the matching place remains. Choose **All tags**, then set **Group by** to **Tag**. Confirm places appear under their tag names and the untagged place appears under **No tags**.
3. Open **Manage categories and tags**. Choose **Category**, select `Culture`, choose **Rename**, enter `Arts`, and choose **Apply to places**. Confirm both places now show `Arts` and the success message announces the number updated.
4. Choose **Tag**, select `museum`, choose **Merge**, and select `family`. Confirm the affected place now has `family` once. Choose **Delete and reassign**, select `outdoors`, and reassign it to `family`. Confirm that place now has `family` once.
5. Reload the page and confirm category and tag changes remain. Repeat the controls with the keyboard and confirm the success message is announced.

Expected: category and tag filters combine, groups include unassigned places, rename and merge update all uses, tag merges do not duplicate values, and clearing a value removes it from every affected place.

## F-002-T06 — Delete a place

1. Add two places named `Unused deletion check` and `Used deletion check`.
2. With the keyboard, choose **Delete Unused deletion check** and accept the browser confirmation. Confirm the place disappears, `Unused deletion check was deleted.` is announced, and focus returns to the **Places** heading. Reload and confirm it stays deleted.
3. Copy the ID of `Used deletion check` from `http://127.0.0.1:4310/api/places`. Create a one-day trip reference with the local API (replace `PLACE_ID` with that ID):

   ```sh
   curl -i -X POST http://127.0.0.1:4310/api/trips \
     -H 'content-type: application/json' \
     -d '{"name":"Place deletion check","startDate":"2026-11-27","endDate":"2026-11-27","days":[{"date":"2026-11-27","stops":["PLACE_ID"]}]}'
   ```

4. Open **Edit Used deletion check**, choose **Delete place**, and accept the confirmation. Confirm the announced error names `Place deletion check`; the form stays open, the place remains in the list, and the trip still contains its stop. Cancel the edit.
5. Delete the test trip through `DELETE /api/trips/<trip-id>`, then delete `Used deletion check` from the list.

Expected: confirmation is keyboard-operable; successful deletion is announced and returns focus to the page; deletion is refused for a referenced place with the trip name, preserving the place and trip stop.

## F-003-T02 — Trip editor

1. Set a home place in **Settings**, or leave it unset to check the empty home label. Create two saved test places: `Harbour` in category `Coast` with tag `water`, and `Ridge View` in category `Outdoors` with tag `viewpoint`.
2. Open `http://localhost:4200/trips`, choose **Add trip**, enter `Coast Loop`, and set the start date to `2026-12-02` and end date to `2026-12-03`. Choose `Harbour` as the starting point and **Custom name** as the ending point; enter `Ridge Trailhead`.
3. Search for `ridge`, select category `Outdoors` and tag `viewpoint`. Choose `2026-12-03` in **Add a stop to this day**, then choose **Add Ridge View**. Confirm it appears on December 3. Clear the search and filters; add `Harbour` to December 2.
4. In **Add a place by name**, enter `New Lookout` and choose **Create place and add stop**. Confirm it is added to the selected day. Save the trip and confirm **Trip saved.** is announced.
5. Reload the page. Choose **Edit Coast Loop** and confirm dates, endpoints and stops persist. Change its name to `Coast Loop Extended`, save, and confirm the updated trip is listed.
6. Repeat the core flow with the keyboard: add a trip, enter its fields, filter and add a stop, create a place, save, and edit. Confirm all controls can receive keyboard focus, validation errors are announced, and save success is announced.

Expected: trips save with their date range, from/to endpoints and selected places; place search and category/tag filters combine; a new place is created and added as a stop; saved trips can be reopened and edited. Reordering and moving stops are checked in F-003-T03.

## F-003-T03 — Reorder stops and move them between days

1. Create or edit a two-day trip named `Stop order check` for `2026-12-02` through `2026-12-03`. Add `Harbour`, `Ridge View` and `New Lookout` to December 2, in that order. Add another saved place to December 3, then save.
2. Drag `New Lookout` above `Harbour` within December 2. Confirm the visible stop order changes. Drag `Ridge View` to the end of December 3 and confirm it appears after the existing stop there.
3. Repeat with the keyboard using the stop controls. Move `Harbour` after `New Lookout`, then move `Ridge View` from December 3 to December 2. Confirm focus remains on a usable stop control and the changed order/day is announced or visible.
4. Save and reload the trip. Confirm both day assignments and the exact stop order persist.

Expected: pointer drag and keyboard controls both reorder stops within a day and move them between days; saving and reloading preserves each stop's order and day.
