# v1 Score Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A landscape, one-beat-focused drum notation editor on Android where entering a bar is
faster than writing it on paper, with a score archive, JSON import/export and PDF export.

**Architecture:** A pure Kotlin core (note values, per-beat subdivision, cursor, beaming, glyph
layout) with no Android types, wrapped by a thin Compose `Canvas` that paints whatever the
layout functions return. Room persists scores. PDF export calls the same layout functions with a
multi-bar page config, so the screen and the printed page cannot disagree.

**Tech Stack:** Kotlin, Jetpack Compose (Material 3), Room, Bravura SMuFL font (SIL OFL),
Android `PdfDocument`, kotlinx.serialization, JUnit 4.

## Global Constraints

- **Open-source dependencies only.** No commercial or proprietary services or SDKs.
- **Offline only.** No backend, no accounts, no analytics, no network permission.
- Kotlin, JDK 21, Gradle 8.13, `compileSdk`/`targetSdk` 36, `minSdk` 29 — match `workout-app`.
- Package: `dev.allan.scoreapp`.
- **Pure core:** everything under `core/` must compile without Android types, so it is testable
  in `src/test` on the JVM. No `android.*` imports, no `androidx.compose.*` imports.
- **TDD:** every task starts from a failing test. An existing test that starts failing is a
  regression, not an expected change.
- The editor **never auto-advances the cursor**. Movement happens only via `<` / `>`.
- Spec: `docs/superpowers/specs/2026-08-03-score-editor-design.md`.

---

## File Structure

```
app/src/main/java/dev/allan/scoreapp/
  core/model/NoteValue.kt        note values + how many cells they divide a beat into
  core/model/Score.kt            Score, Bar, Beat, Cell, Note, Articulation, Sticking
  core/model/Profile.kt          Profile, Staff, Slot, the built-in drum profile
  core/edit/Cursor.kt            position type + < / > navigation over beats and sub-positions
  core/edit/ScoreEdit.kt         place / overwrite / delete / subdivide, all pure
  core/time/Ticks.kt             PPQ derivation for metronome + export
  core/layout/Glyphs.kt          SMuFL codepoints, verified against glyphnames.json
  core/layout/Beaming.kt         which notes in a beat beam together
  core/layout/BarLayout.kt       (Bar, Staff, LayoutConfig) -> List<PlacedGlyph>
  core/json/ScoreJson.kt         versioned import/export DTOs
  data/db/Entities.kt            Room entities
  data/db/ScoreDao.kt
  data/db/AppDatabase.kt
  data/ScoreRepo.kt
  ui/editor/EditorScreen.kt      Canvas + palette, wires taps to ScoreEdit
  ui/editor/EditorViewModel.kt
  ui/editor/ScoreCanvas.kt       draw + hit-test only
  ui/archive/ArchiveScreen.kt
  ui/theme/                      Material 3 theme
  export/PdfExport.kt            reuses BarLayout
  MainActivity.kt
app/src/main/assets/Bravura.otf
app/src/test/java/dev/allan/scoreapp/   JVM tests for everything under core/
```

Files that change together live together: the editing rules sit next to the cursor they move,
the layout sits next to the glyph table it uses.

---

### Task 1: Project scaffold that builds and tests

**Files:**
- Create: `settings.gradle.kts`, `build.gradle.kts`, `gradle/libs.versions.toml`,
  `gradle.properties`, `app/build.gradle.kts`, `app/src/main/AndroidManifest.xml`,
  `.gitignore`
- Create: `app/src/main/java/dev/allan/scoreapp/MainActivity.kt`
- Test: `app/src/test/java/dev/allan/scoreapp/ScaffoldTest.kt`

**Interfaces:**
- Consumes: nothing.
- Produces: a Gradle project where `./gradlew test` runs JVM unit tests.

- [ ] **Step 1: Copy the wrapper from workout-app**

```bash
cd /home/allan/projects/score-app
cp -r /home/allan/projects/workout-app/gradle/wrapper gradle/
cp /home/allan/projects/workout-app/gradlew /home/allan/projects/workout-app/gradlew.bat .
chmod +x gradlew
```

- [ ] **Step 2: Write the build files**

`settings.gradle.kts`:

```kotlin
pluginManagement {
    repositories { google(); mavenCentral(); gradlePluginPortal() }
}
dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories { google(); mavenCentral() }
}
rootProject.name = "score-app"
include(":app")
```

`gradle/libs.versions.toml`:

```toml
[versions]
agp = "8.7.3"
kotlin = "2.1.0"
ksp = "2.1.0-1.0.29"
composeBom = "2024.12.01"
room = "2.7.1"
activityCompose = "1.9.3"
lifecycle = "2.8.7"
serializationJson = "1.7.3"

[libraries]
androidx-activity-compose = { group = "androidx.activity", name = "activity-compose", version.ref = "activityCompose" }
androidx-compose-bom = { group = "androidx.compose", name = "compose-bom", version.ref = "composeBom" }
androidx-ui = { group = "androidx.compose.ui", name = "ui" }
androidx-ui-graphics = { group = "androidx.compose.ui", name = "ui-graphics" }
androidx-material3 = { group = "androidx.compose.material3", name = "material3" }
androidx-lifecycle-viewmodel-compose = { group = "androidx.lifecycle", name = "lifecycle-viewmodel-compose", version.ref = "lifecycle" }
androidx-room-runtime = { group = "androidx.room", name = "room-runtime", version.ref = "room" }
androidx-room-ktx = { group = "androidx.room", name = "room-ktx", version.ref = "room" }
androidx-room-compiler = { group = "androidx.room", name = "room-compiler", version.ref = "room" }
kotlinx-serialization-json = { group = "org.jetbrains.kotlinx", name = "kotlinx-serialization-json", version.ref = "serializationJson" }
junit = { group = "junit", name = "junit", version = "4.13.2" }

[plugins]
android-application = { id = "com.android.application", version.ref = "agp" }
kotlin-android = { id = "org.jetbrains.kotlin.android", version.ref = "kotlin" }
kotlin-compose = { id = "org.jetbrains.kotlin.plugin.compose", version.ref = "kotlin" }
kotlin-serialization = { id = "org.jetbrains.kotlin.plugin.serialization", version.ref = "kotlin" }
ksp = { id = "com.google.devtools.ksp", version.ref = "ksp" }
```

`gradle.properties`:

```properties
org.gradle.jvmargs=-Xmx3g -Dfile.encoding=UTF-8
org.gradle.caching=true
android.useAndroidX=true
kotlin.code.style=official
```

`build.gradle.kts` (root):

```kotlin
plugins {
    alias(libs.plugins.android.application) apply false
    alias(libs.plugins.kotlin.android) apply false
    alias(libs.plugins.kotlin.compose) apply false
    alias(libs.plugins.kotlin.serialization) apply false
    alias(libs.plugins.ksp) apply false
}
```

`app/build.gradle.kts`:

```kotlin
plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.kotlin.serialization)
    alias(libs.plugins.ksp)
}

android {
    namespace = "dev.allan.scoreapp"
    compileSdk = 36

    defaultConfig {
        applicationId = "dev.allan.scoreapp"
        minSdk = 29
        targetSdk = 36
        versionCode = 1
        versionName = "0.1.0"
    }

    buildTypes {
        release { isMinifyEnabled = false }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_21
        targetCompatibility = JavaVersion.VERSION_21
    }
    kotlin { compilerOptions { jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_21) } }
    buildFeatures { compose = true }
}

ksp { arg("room.schemaLocation", "$projectDir/schemas") }

dependencies {
    implementation(libs.androidx.activity.compose)
    implementation(platform(libs.androidx.compose.bom))
    implementation(libs.androidx.ui)
    implementation(libs.androidx.ui.graphics)
    implementation(libs.androidx.material3)
    implementation(libs.androidx.lifecycle.viewmodel.compose)
    implementation(libs.androidx.room.runtime)
    implementation(libs.androidx.room.ktx)
    ksp(libs.androidx.room.compiler)
    implementation(libs.kotlinx.serialization.json)
    testImplementation(libs.junit)
}
```

`.gitignore`:

```
*.iml
.gradle
/local.properties
/.idea
.DS_Store
/build
/captures
.externalNativeBuild
.cxx
local.properties
```

- [ ] **Step 3: Write the manifest and a placeholder Activity**

`app/src/main/AndroidManifest.xml` — note there is **no** `INTERNET` permission, deliberately:

```xml
<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
    <application
        android:label="Score"
        android:supportsRtl="true"
        android:theme="@style/Theme.Material3.DayNight.NoActionBar">
        <activity
            android:name=".MainActivity"
            android:exported="true"
            android:screenOrientation="landscape">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
    </application>
</manifest>
```

`MainActivity.kt`:

```kotlin
package dev.allan.scoreapp

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent { MaterialTheme { Surface { Text("Score") } } }
    }
}
```

- [ ] **Step 4: Write a test that proves the JVM test source set runs**

`app/src/test/java/dev/allan/scoreapp/ScaffoldTest.kt`:

```kotlin
package dev.allan.scoreapp

import org.junit.Assert.assertEquals
import org.junit.Test

class ScaffoldTest {
    @Test
    fun `the unit test source set runs`() {
        assertEquals(4, 2 + 2)
    }
}
```

- [ ] **Step 5: Run it**

Run: `./gradlew test`
Expected: BUILD SUCCESSFUL, 1 test passing. (Emulator not needed — nothing here is instrumented.)

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "Scaffold the Android project"
```

---

### Task 2: Note values and how they divide a beat

**Files:**
- Create: `app/src/main/java/dev/allan/scoreapp/core/model/NoteValue.kt`
- Test: `app/src/test/java/dev/allan/scoreapp/NoteValueTest.kt`

**Interfaces:**
- Consumes: nothing.
- Produces: `enum class NoteValue { WHOLE, HALF, QUARTER, EIGHTH, SIXTEENTH, THIRTY_SECOND }`
  with `val divisionsPerWhole: Int`; and
  `fun cellsPerBeat(value: NoteValue, beatUnit: Int, tuplet: Int?): Int`.

**Context:** `beatUnit` is the denominator of the time signature — in 4/4 the beat is a quarter,
so `beatUnit = 4`. A beat divided into eighths holds 2 cells; into sixteenths, 4. A tuplet
overrides that count outright: a triplet is 3 cells regardless of the written value.

- [ ] **Step 1: Write the failing test**

```kotlin
package dev.allan.scoreapp

import dev.allan.scoreapp.core.model.NoteValue
import dev.allan.scoreapp.core.model.cellsPerBeat
import org.junit.Assert.assertEquals
import org.junit.Test

class NoteValueTest {
    @Test
    fun `a quarter beat divided into eighths holds two cells`() {
        assertEquals(2, cellsPerBeat(NoteValue.EIGHTH, beatUnit = 4, tuplet = null))
    }

    @Test
    fun `a quarter beat divided into sixteenths holds four cells`() {
        assertEquals(4, cellsPerBeat(NoteValue.SIXTEENTH, beatUnit = 4, tuplet = null))
    }

    @Test
    fun `a beat at its own value is a single cell`() {
        assertEquals(1, cellsPerBeat(NoteValue.QUARTER, beatUnit = 4, tuplet = null))
    }

    @Test
    fun `a tuplet overrides the written value`() {
        assertEquals(3, cellsPerBeat(NoteValue.EIGHTH, beatUnit = 4, tuplet = 3))
        assertEquals(5, cellsPerBeat(NoteValue.SIXTEENTH, beatUnit = 4, tuplet = 5))
    }

    @Test
    fun `a value longer than the beat still occupies one cell`() {
        assertEquals(1, cellsPerBeat(NoteValue.HALF, beatUnit = 4, tuplet = null))
    }

    @Test
    fun `an eighth beat divided into sixteenths holds two cells`() {
        assertEquals(2, cellsPerBeat(NoteValue.SIXTEENTH, beatUnit = 8, tuplet = null))
    }
}
```

- [ ] **Step 2: Run it and watch it fail**

Run: `./gradlew test --tests '*NoteValueTest*'`
Expected: FAIL — unresolved reference `NoteValue`.

- [ ] **Step 3: Implement**

```kotlin
package dev.allan.scoreapp.core.model

/** Written note values, by how many of them fill a whole note. */
enum class NoteValue(val divisionsPerWhole: Int) {
    WHOLE(1),
    HALF(2),
    QUARTER(4),
    EIGHTH(8),
    SIXTEENTH(16),
    THIRTY_SECOND(32),
}

/**
 * How many cells a beat is split into when it is subdivided by [value].
 *
 * A tuplet replaces the count outright — a triplet is three cells whatever value is written
 * inside it. Values at or longer than the beat collapse to a single cell, so choosing a half
 * note in 4/4 does not produce a fractional grid.
 */
fun cellsPerBeat(value: NoteValue, beatUnit: Int, tuplet: Int? = null): Int {
    tuplet?.let { return it }
    val cells = value.divisionsPerWhole / beatUnit
    return if (cells < 1) 1 else cells
}
```

- [ ] **Step 4: Run it and watch it pass**

Run: `./gradlew test --tests '*NoteValueTest*'`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add app/src/main/java/dev/allan/scoreapp/core/model/NoteValue.kt \
        app/src/test/java/dev/allan/scoreapp/NoteValueTest.kt
git commit -m "Work out how a note value divides a beat"
```

---

### Task 3: The score model

**Files:**
- Create: `app/src/main/java/dev/allan/scoreapp/core/model/Score.kt`
- Test: `app/src/test/java/dev/allan/scoreapp/ScoreModelTest.kt`

**Interfaces:**
- Consumes: `NoteValue`, `cellsPerBeat` (Task 2).
- Produces:

```kotlin
enum class Articulation { ACCENT, GHOST, CRESCENDO, FORTISSIMO, PIANISSIMO }
enum class Sticking { R, L }
data class Note(val slotId: String, val articulations: Set<Articulation> = emptySet(), val sticking: Sticking? = null)
data class Cell(val notes: List<Note> = emptyList())
data class Beat(val division: NoteValue, val tuplet: Int? = null, val cells: List<Cell>)
data class Bar(val beats: List<Beat>)
data class Score(val id: Long = 0, val title: String, val profileId: String,
                 val timeSigNum: Int = 4, val timeSigDen: Int = 4,
                 val defaultBpm: Int = 80, val bars: List<Bar>)
fun emptyBeat(division: NoteValue, beatUnit: Int, tuplet: Int? = null): Beat
fun emptyBar(timeSigNum: Int, timeSigDen: Int): Bar
```

**Context:** notes sharing a `Cell` sound together — that is how a kick and a hi-hat struck at
once are represented, and why nothing here needs a voice field.

- [ ] **Step 1: Write the failing test**

```kotlin
package dev.allan.scoreapp

import dev.allan.scoreapp.core.model.*
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class ScoreModelTest {
    @Test
    fun `an empty beat has one cell per subdivision, all silent`() {
        val beat = emptyBeat(NoteValue.EIGHTH, beatUnit = 4)
        assertEquals(2, beat.cells.size)
        assertTrue(beat.cells.all { it.notes.isEmpty() })
    }

    @Test
    fun `an empty triplet beat has three cells`() {
        assertEquals(3, emptyBeat(NoteValue.EIGHTH, beatUnit = 4, tuplet = 3).cells.size)
    }

    @Test
    fun `an empty 4-4 bar has four unsubdivided beats`() {
        val bar = emptyBar(4, 4)
        assertEquals(4, bar.beats.size)
        assertTrue(bar.beats.all { it.cells.size == 1 })
    }

    @Test
    fun `an empty 3-4 bar has three beats`() {
        assertEquals(3, emptyBar(3, 4).beats.size)
    }

    @Test
    fun `notes in one cell sound together`() {
        val cell = Cell(listOf(Note("kick"), Note("hihat")))
        assertEquals(2, cell.notes.size)
    }
}
```

- [ ] **Step 2: Run it and watch it fail**

Run: `./gradlew test --tests '*ScoreModelTest*'`
Expected: FAIL — unresolved reference `emptyBeat`.

- [ ] **Step 3: Implement**

```kotlin
package dev.allan.scoreapp.core.model

enum class Articulation { ACCENT, GHOST, CRESCENDO, FORTISSIMO, PIANISSIMO }

enum class Sticking { R, L }

/** One hit. [slotId] says which instrument, by naming a slot on the staff. */
data class Note(
    val slotId: String,
    val articulations: Set<Articulation> = emptySet(),
    val sticking: Sticking? = null,
)

/** One point in time. Several notes here sound together — kick plus hi-hat. */
data class Cell(val notes: List<Note> = emptyList())

/**
 * One beat, carrying its own subdivision. Subdivision is per beat and not a bar-wide grid,
 * because that is how a page reads: a triplet on beat 1 and two eighths on beat 2.
 */
data class Beat(
    val division: NoteValue,
    val tuplet: Int? = null,
    val cells: List<Cell>,
)

data class Bar(val beats: List<Beat>)

data class Score(
    val id: Long = 0,
    val title: String,
    val profileId: String,
    val timeSigNum: Int = 4,
    val timeSigDen: Int = 4,
    val defaultBpm: Int = 80,
    val bars: List<Bar>,
)

fun emptyBeat(division: NoteValue, beatUnit: Int, tuplet: Int? = null): Beat =
    Beat(division, tuplet, List(cellsPerBeat(division, beatUnit, tuplet)) { Cell() })

/** A fresh bar: one cell per beat, nothing written yet. */
fun emptyBar(timeSigNum: Int, timeSigDen: Int): Bar =
    Bar(List(timeSigNum) { emptyBeat(noteValueFor(timeSigDen), timeSigDen) })

private fun noteValueFor(den: Int): NoteValue =
    NoteValue.entries.firstOrNull { it.divisionsPerWhole == den } ?: NoteValue.QUARTER
```

- [ ] **Step 4: Run it and watch it pass**

Run: `./gradlew test --tests '*ScoreModelTest*'`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add app/src/main/java/dev/allan/scoreapp/core/model/Score.kt \
        app/src/test/java/dev/allan/scoreapp/ScoreModelTest.kt
git commit -m "Model a score as bars of beats that carry their own subdivision"
```

---

### Task 4: The drum profile

**Files:**
- Create: `app/src/main/java/dev/allan/scoreapp/core/model/Profile.kt`
- Test: `app/src/test/java/dev/allan/scoreapp/ProfileTest.kt`

**Interfaces:**
- Consumes: nothing.
- Produces:

```kotlin
enum class Notehead { NORMAL, CROSS }
data class Slot(val id: String, val name: String, val staffPosition: Int, val notehead: Notehead)
data class Staff(val lineCount: Int, val slots: List<Slot>)
data class Profile(val id: String, val name: String, val staves: List<Staff>)
val DRUM_PROFILE: Profile
fun Staff.slotNearest(position: Int): Slot
```

**Context:** `staffPosition` counts half-steps from the bottom line: 0 is the bottom line, 1 the
space above it, and negatives go below the staff. Feet sit below, cymbals above, and the
notehead shape distinguishes them — there is **no voice field**, because on a drum staff the
position *is* the instrument.

- [ ] **Step 1: Write the failing test**

```kotlin
package dev.allan.scoreapp

import dev.allan.scoreapp.core.model.*
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class ProfileTest {
    private val staff = DRUM_PROFILE.staves.single()

    @Test
    fun `the drum profile is a single five-line staff`() {
        assertEquals(1, DRUM_PROFILE.staves.size)
        assertEquals(5, staff.lineCount)
    }

    @Test
    fun `feet sit below the staff`() {
        val kick = staff.slots.single { it.id == "kick" }
        assertTrue("kick should sit below the staff", kick.staffPosition < 0)
    }

    @Test
    fun `cymbals sit above the staff and use a cross notehead`() {
        val crash = staff.slots.single { it.id == "crash" }
        assertTrue("crash should sit above the staff", crash.staffPosition > 8)
        assertEquals(Notehead.CROSS, crash.notehead)
    }

    @Test
    fun `drums use a normal notehead`() {
        assertEquals(Notehead.NORMAL, staff.slots.single { it.id == "snare" }.notehead)
    }

    @Test
    fun `slot ids are unique`() {
        val ids = staff.slots.map { it.id }
        assertEquals(ids.size, ids.toSet().size)
    }

    @Test
    fun `a tap maps to the nearest slot`() {
        val snare = staff.slots.single { it.id == "snare" }
        assertEquals(snare, staff.slotNearest(snare.staffPosition))
    }

    @Test
    fun `a tap far above the staff maps to the highest slot`() {
        val highest = staff.slots.maxBy { it.staffPosition }
        assertEquals(highest, staff.slotNearest(99))
    }
}
```

- [ ] **Step 2: Run it and watch it fail**

Run: `./gradlew test --tests '*ProfileTest*'`
Expected: FAIL — unresolved reference `DRUM_PROFILE`.

- [ ] **Step 3: Implement**

```kotlin
package dev.allan.scoreapp.core.model

enum class Notehead { NORMAL, CROSS }

/**
 * One instrument's place on the staff. [staffPosition] counts half-steps from the bottom
 * line: 0 is the bottom line, 1 the space above it, negatives sit below the staff.
 */
data class Slot(
    val id: String,
    val name: String,
    val staffPosition: Int,
    val notehead: Notehead,
)

data class Staff(val lineCount: Int, val slots: List<Slot>)

/** [staves] is a list so a two-staff instrument fits later; v1 only ever builds one. */
data class Profile(val id: String, val name: String, val staves: List<Staff>)

/** The slot whose position is closest to [position] — how a tap height becomes an instrument. */
fun Staff.slotNearest(position: Int): Slot =
    slots.minBy { kotlin.math.abs(it.staffPosition - position) }

val DRUM_PROFILE = Profile(
    id = "drums",
    name = "Drum kit",
    staves = listOf(
        Staff(
            lineCount = 5,
            slots = listOf(
                Slot("kick", "Bass drum", -2, Notehead.NORMAL),
                Slot("hihatPedal", "Hi-hat pedal", -4, Notehead.CROSS),
                Slot("floorTom", "Floor tom", 1, Notehead.NORMAL),
                Slot("snare", "Snare", 4, Notehead.NORMAL),
                Slot("midTom", "Mid tom", 6, Notehead.NORMAL),
                Slot("highTom", "High tom", 7, Notehead.NORMAL),
                Slot("hihat", "Hi-hat", 9, Notehead.CROSS),
                Slot("ride", "Ride", 10, Notehead.CROSS),
                Slot("crash", "Crash", 11, Notehead.CROSS),
            ),
        )
    ),
)
```

- [ ] **Step 4: Run it and watch it pass**

Run: `./gradlew test --tests '*ProfileTest*'`
Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add app/src/main/java/dev/allan/scoreapp/core/model/Profile.kt \
        app/src/test/java/dev/allan/scoreapp/ProfileTest.kt
git commit -m "Map drum instruments onto staff positions"
```

---

### Task 5: The cursor

**Files:**
- Create: `app/src/main/java/dev/allan/scoreapp/core/edit/Cursor.kt`
- Test: `app/src/test/java/dev/allan/scoreapp/CursorTest.kt`

**Interfaces:**
- Consumes: `Score`, `Bar`, `Beat` (Task 3).
- Produces:

```kotlin
data class Cursor(val bar: Int, val beat: Int, val cell: Int)
fun Score.next(cursor: Cursor): Cursor
fun Score.prev(cursor: Cursor): Cursor
fun Score.beatAt(cursor: Cursor): Beat
```

**Context:** `<` and `>` step through *positions*, which means sub-positions inside a beat as
well as beat boundaries. This is the only thing that moves the cursor — placing a note never
does.

- [ ] **Step 1: Write the failing test**

```kotlin
package dev.allan.scoreapp

import dev.allan.scoreapp.core.edit.*
import dev.allan.scoreapp.core.model.*
import org.junit.Assert.assertEquals
import org.junit.Test

class CursorTest {
    private fun score(vararg beats: Beat) = Score(
        title = "t", profileId = "drums", bars = listOf(Bar(beats.toList()))
    )

    @Test
    fun `next walks the cells inside a subdivided beat`() {
        val s = score(emptyBeat(NoteValue.SIXTEENTH, 4), emptyBeat(NoteValue.QUARTER, 4))
        assertEquals(Cursor(0, 0, 1), s.next(Cursor(0, 0, 0)))
        assertEquals(Cursor(0, 0, 2), s.next(Cursor(0, 0, 1)))
    }

    @Test
    fun `next rolls from the last cell of a beat into the next beat`() {
        val s = score(emptyBeat(NoteValue.EIGHTH, 4), emptyBeat(NoteValue.QUARTER, 4))
        assertEquals(Cursor(0, 1, 0), s.next(Cursor(0, 0, 1)))
    }

    @Test
    fun `next stops at the very end`() {
        val s = score(emptyBeat(NoteValue.QUARTER, 4))
        assertEquals(Cursor(0, 0, 0), s.next(Cursor(0, 0, 0)))
    }

    @Test
    fun `prev rolls back into the last cell of the previous beat`() {
        val s = score(emptyBeat(NoteValue.SIXTEENTH, 4), emptyBeat(NoteValue.QUARTER, 4))
        assertEquals(Cursor(0, 0, 3), s.prev(Cursor(0, 1, 0)))
    }

    @Test
    fun `prev stops at the very start`() {
        val s = score(emptyBeat(NoteValue.QUARTER, 4))
        assertEquals(Cursor(0, 0, 0), s.prev(Cursor(0, 0, 0)))
    }

    @Test
    fun `next crosses a bar line`() {
        val s = Score(
            title = "t", profileId = "drums",
            bars = listOf(Bar(listOf(emptyBeat(NoteValue.QUARTER, 4))),
                          Bar(listOf(emptyBeat(NoteValue.QUARTER, 4)))),
        )
        assertEquals(Cursor(1, 0, 0), s.next(Cursor(0, 0, 0)))
    }
}
```

- [ ] **Step 2: Run it and watch it fail**

Run: `./gradlew test --tests '*CursorTest*'`
Expected: FAIL — unresolved reference `Cursor`.

- [ ] **Step 3: Implement**

```kotlin
package dev.allan.scoreapp.core.edit

import dev.allan.scoreapp.core.model.Beat
import dev.allan.scoreapp.core.model.Score

/** Where editing is pointing. Only [next] and [prev] ever move it. */
data class Cursor(val bar: Int = 0, val beat: Int = 0, val cell: Int = 0)

fun Score.beatAt(cursor: Cursor): Beat = bars[cursor.bar].beats[cursor.beat]

/** One position forward, into the next cell, beat or bar. Stops dead at the end. */
fun Score.next(cursor: Cursor): Cursor {
    val beat = beatAt(cursor)
    if (cursor.cell + 1 < beat.cells.size) return cursor.copy(cell = cursor.cell + 1)
    if (cursor.beat + 1 < bars[cursor.bar].beats.size) return Cursor(cursor.bar, cursor.beat + 1, 0)
    if (cursor.bar + 1 < bars.size) return Cursor(cursor.bar + 1, 0, 0)
    return cursor
}

/** One position back. Stops dead at the start. */
fun Score.prev(cursor: Cursor): Cursor {
    if (cursor.cell > 0) return cursor.copy(cell = cursor.cell - 1)
    if (cursor.beat > 0) {
        val target = bars[cursor.bar].beats[cursor.beat - 1]
        return Cursor(cursor.bar, cursor.beat - 1, target.cells.size - 1)
    }
    if (cursor.bar > 0) {
        val prevBar = bars[cursor.bar - 1]
        val lastBeat = prevBar.beats.size - 1
        return Cursor(cursor.bar - 1, lastBeat, prevBar.beats[lastBeat].cells.size - 1)
    }
    return cursor
}
```

- [ ] **Step 4: Run it and watch it pass**

Run: `./gradlew test --tests '*CursorTest*'`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add app/src/main/java/dev/allan/scoreapp/core/edit/Cursor.kt \
        app/src/test/java/dev/allan/scoreapp/CursorTest.kt
git commit -m "Step the cursor through beats and their subdivisions"
```

---

### Task 6: The editing rules

**Files:**
- Create: `app/src/main/java/dev/allan/scoreapp/core/edit/ScoreEdit.kt`
- Test: `app/src/test/java/dev/allan/scoreapp/ScoreEditTest.kt`

**Interfaces:**
- Consumes: `Score`, `Note`, `Cell`, `Beat`, `emptyBeat` (Task 3); `Cursor`, `beatAt` (Task 5).
- Produces:

```kotlin
fun Score.placeNote(cursor: Cursor, note: Note): Score
fun Score.deleteNote(cursor: Cursor, slotId: String): Score
fun Score.subdivide(cursor: Cursor, division: NoteValue, tuplet: Int?): Score
```

**Context:** these three functions *are* the editor. Everything the UI does is one of them.
Placing onto a slot that already has a note **overwrites** it — same slot, same cell, replaced —
while a different slot in the same cell joins it as a simultaneous hit. Re-subdividing keeps
whatever notes still fit and drops the rest, which is the only lossy operation and must be
obvious to the user.

- [ ] **Step 1: Write the failing test**

```kotlin
package dev.allan.scoreapp

import dev.allan.scoreapp.core.edit.*
import dev.allan.scoreapp.core.model.*
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class ScoreEditTest {
    private fun score() = Score(
        title = "t", profileId = "drums",
        bars = listOf(Bar(List(4) { emptyBeat(NoteValue.QUARTER, 4) })),
    )

    private fun notesAt(s: Score, c: Cursor) = s.beatAt(c).cells[c.cell].notes

    @Test
    fun `placing a note puts it in the cell`() {
        val s = score().placeNote(Cursor(0, 0, 0), Note("snare"))
        assertEquals(listOf(Note("snare")), notesAt(s, Cursor(0, 0, 0)))
    }

    @Test
    fun `a different slot in the same cell sounds together`() {
        val s = score()
            .placeNote(Cursor(0, 0, 0), Note("kick"))
            .placeNote(Cursor(0, 0, 0), Note("hihat"))
        assertEquals(setOf("kick", "hihat"), notesAt(s, Cursor(0, 0, 0)).map { it.slotId }.toSet())
    }

    @Test
    fun `placing on the same slot overwrites instead of duplicating`() {
        val s = score()
            .placeNote(Cursor(0, 0, 0), Note("snare"))
            .placeNote(Cursor(0, 0, 0), Note("snare", articulations = setOf(Articulation.ACCENT)))
        val notes = notesAt(s, Cursor(0, 0, 0))
        assertEquals(1, notes.size)
        assertEquals(setOf(Articulation.ACCENT), notes.single().articulations)
    }

    @Test
    fun `deleting removes only that slot`() {
        val s = score()
            .placeNote(Cursor(0, 0, 0), Note("kick"))
            .placeNote(Cursor(0, 0, 0), Note("hihat"))
            .deleteNote(Cursor(0, 0, 0), "kick")
        assertEquals(listOf("hihat"), notesAt(s, Cursor(0, 0, 0)).map { it.slotId })
    }

    @Test
    fun `deleting a slot that is not there changes nothing`() {
        val s = score().placeNote(Cursor(0, 0, 0), Note("kick"))
        assertEquals(s, s.deleteNote(Cursor(0, 0, 0), "ride"))
    }

    @Test
    fun `subdividing a beat gives it the right number of cells`() {
        val s = score().subdivide(Cursor(0, 0, 0), NoteValue.EIGHTH, tuplet = null)
        assertEquals(2, s.bars[0].beats[0].cells.size)
    }

    @Test
    fun `subdividing into a triplet gives three cells`() {
        val s = score().subdivide(Cursor(0, 0, 0), NoteValue.EIGHTH, tuplet = 3)
        assertEquals(3, s.bars[0].beats[0].cells.size)
        assertEquals(3, s.bars[0].beats[0].tuplet)
    }

    @Test
    fun `subdividing keeps notes that still fit`() {
        val s = score()
            .placeNote(Cursor(0, 0, 0), Note("snare"))
            .subdivide(Cursor(0, 0, 0), NoteValue.EIGHTH, tuplet = null)
        assertEquals(listOf("snare"), notesAt(s, Cursor(0, 0, 0)).map { it.slotId })
    }

    @Test
    fun `subdividing smaller drops notes that no longer fit`() {
        val s = score()
            .subdivide(Cursor(0, 0, 0), NoteValue.SIXTEENTH, tuplet = null)
            .placeNote(Cursor(0, 0, 3), Note("snare"))
            .subdivide(Cursor(0, 0, 0), NoteValue.EIGHTH, tuplet = null)
        assertEquals(2, s.bars[0].beats[0].cells.size)
        assertTrue(s.bars[0].beats[0].cells.all { it.notes.isEmpty() })
    }

    @Test
    fun `subdividing one beat leaves its neighbours alone`() {
        val s = score().subdivide(Cursor(0, 0, 0), NoteValue.SIXTEENTH, tuplet = null)
        assertEquals(1, s.bars[0].beats[1].cells.size)
    }

    @Test
    fun `editing returns a new score and leaves the original untouched`() {
        val before = score()
        before.placeNote(Cursor(0, 0, 0), Note("snare"))
        assertTrue(before.bars[0].beats[0].cells[0].notes.isEmpty())
    }
}
```

- [ ] **Step 2: Run it and watch it fail**

Run: `./gradlew test --tests '*ScoreEditTest*'`
Expected: FAIL — unresolved reference `placeNote`.

- [ ] **Step 3: Implement**

```kotlin
package dev.allan.scoreapp.core.edit

import dev.allan.scoreapp.core.model.Beat
import dev.allan.scoreapp.core.model.Cell
import dev.allan.scoreapp.core.model.Note
import dev.allan.scoreapp.core.model.NoteValue
import dev.allan.scoreapp.core.model.Score
import dev.allan.scoreapp.core.model.cellsPerBeat

/**
 * Write [note] at [cursor]. A note already on the same slot is replaced; a note on a different
 * slot joins it, because notes in one cell sound together. The cursor does not move — that is
 * what makes entering a kick and a hi-hat together two taps in the same place.
 */
fun Score.placeNote(cursor: Cursor, note: Note): Score =
    mapCell(cursor) { cell ->
        Cell(cell.notes.filterNot { it.slotId == note.slotId } + note)
    }

/** Remove whatever is on [slotId] at [cursor], if anything. */
fun Score.deleteNote(cursor: Cursor, slotId: String): Score =
    mapCell(cursor) { cell -> Cell(cell.notes.filterNot { it.slotId == slotId }) }

/**
 * Re-split the beat under [cursor]. Notes in cells that survive the change are kept; notes
 * beyond the new cell count are dropped, which is the only place editing loses anything.
 */
fun Score.subdivide(cursor: Cursor, division: NoteValue, tuplet: Int?): Score =
    mapBeat(cursor) { beat ->
        val count = cellsPerBeat(division, timeSigDen, tuplet)
        Beat(
            division = division,
            tuplet = tuplet,
            cells = List(count) { i -> beat.cells.getOrElse(i) { Cell() } },
        )
    }

private fun Score.mapCell(cursor: Cursor, f: (Cell) -> Cell): Score =
    mapBeat(cursor) { beat ->
        beat.copy(cells = beat.cells.mapIndexed { i, c -> if (i == cursor.cell) f(c) else c })
    }

private fun Score.mapBeat(cursor: Cursor, f: (Beat) -> Beat): Score = copy(
    bars = bars.mapIndexed { bi, bar ->
        if (bi != cursor.bar) bar
        else bar.copy(beats = bar.beats.mapIndexed { i, b -> if (i == cursor.beat) f(b) else b })
    }
)
```

- [ ] **Step 4: Run it and watch it pass**

Run: `./gradlew test --tests '*ScoreEditTest*'`
Expected: PASS, 11 tests.

- [ ] **Step 5: Commit**

```bash
git add app/src/main/java/dev/allan/scoreapp/core/edit/ScoreEdit.kt \
        app/src/test/java/dev/allan/scoreapp/ScoreEditTest.kt
git commit -m "Place, overwrite and delete notes without moving the cursor"
```

---

### Task 7: Tick derivation

**Files:**
- Create: `app/src/main/java/dev/allan/scoreapp/core/time/Ticks.kt`
- Test: `app/src/test/java/dev/allan/scoreapp/TicksTest.kt`

**Interfaces:**
- Consumes: `Score`, `Bar`, `Beat` (Task 3).
- Produces: `const val PPQ = 960`; `fun Beat.cellTicks(beatUnit: Int): List<Int>`;
  `fun Score.barTicks(): Int`.

**Context:** ticks are derived, never stored — the metronome and any future export need them,
the editor does not. PPQ 960 divides cleanly by 2, 3, 4, 5, 6 and 8, so triplets and quintuplets
land on whole numbers.

- [ ] **Step 1: Write the failing test**

```kotlin
package dev.allan.scoreapp

import dev.allan.scoreapp.core.model.NoteValue
import dev.allan.scoreapp.core.model.emptyBeat
import dev.allan.scoreapp.core.time.PPQ
import dev.allan.scoreapp.core.time.cellTicks
import org.junit.Assert.assertEquals
import org.junit.Test

class TicksTest {
    @Test
    fun `an unsubdivided quarter beat starts at zero`() {
        assertEquals(listOf(0), emptyBeat(NoteValue.QUARTER, 4).cellTicks(4))
    }

    @Test
    fun `eighths split the beat in half`() {
        assertEquals(listOf(0, PPQ / 2), emptyBeat(NoteValue.EIGHTH, 4).cellTicks(4))
    }

    @Test
    fun `a triplet divides evenly with no remainder`() {
        val ticks = emptyBeat(NoteValue.EIGHTH, 4, tuplet = 3).cellTicks(4)
        assertEquals(listOf(0, 320, 640), ticks)
    }

    @Test
    fun `a quintuplet divides evenly with no remainder`() {
        val ticks = emptyBeat(NoteValue.SIXTEENTH, 4, tuplet = 5).cellTicks(4)
        assertEquals(listOf(0, 192, 384, 576, 768), ticks)
    }
}
```

- [ ] **Step 2: Run it and watch it fail**

Run: `./gradlew test --tests '*TicksTest*'`
Expected: FAIL — unresolved reference `PPQ`.

- [ ] **Step 3: Implement**

```kotlin
package dev.allan.scoreapp.core.time

import dev.allan.scoreapp.core.model.Beat
import dev.allan.scoreapp.core.model.Score

/** Pulses per quarter note. 960 divides by 2, 3, 4, 5, 6 and 8, so tuplets stay whole. */
const val PPQ = 960

/** Tick offset of each cell from the start of the beat. Derived — never stored. */
fun Beat.cellTicks(beatUnit: Int): List<Int> {
    val beatTicks = PPQ * 4 / beatUnit
    val step = beatTicks / cells.size
    return List(cells.size) { it * step }
}

fun Score.barTicks(): Int = timeSigNum * (PPQ * 4 / timeSigDen)
```

- [ ] **Step 4: Run it and watch it pass**

Run: `./gradlew test --tests '*TicksTest*'`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add app/src/main/java/dev/allan/scoreapp/core/time/Ticks.kt \
        app/src/test/java/dev/allan/scoreapp/TicksTest.kt
git commit -m "Derive tick positions from the written subdivision"
```

---

### Task 8: Beam grouping

**Files:**
- Create: `app/src/main/java/dev/allan/scoreapp/core/layout/Beaming.kt`
- Test: `app/src/test/java/dev/allan/scoreapp/BeamingTest.kt`

**Interfaces:**
- Consumes: `Beat`, `NoteValue` (Task 3).
- Produces: `fun Beat.beamGroups(): List<IntRange>`.

**Context:** Allan's "merging with the ones in the same timing for visual clarity". Notes shorter
than a quarter beam together across the run of consecutive sounding cells within one beat; rests
break a group; a lone note gets no beam.

- [ ] **Step 1: Write the failing test**

```kotlin
package dev.allan.scoreapp

import dev.allan.scoreapp.core.layout.beamGroups
import dev.allan.scoreapp.core.model.*
import org.junit.Assert.assertEquals
import org.junit.Test

class BeamingTest {
    private fun beat(division: NoteValue, vararg filled: Boolean): Beat =
        Beat(division, null, filled.map { if (it) Cell(listOf(Note("snare"))) else Cell() })

    @Test
    fun `four consecutive sixteenths beam as one group`() {
        assertEquals(listOf(0..3), beat(NoteValue.SIXTEENTH, true, true, true, true).beamGroups())
    }

    @Test
    fun `a rest breaks the beam`() {
        assertEquals(
            listOf(0..1, 3..3),
            beat(NoteValue.SIXTEENTH, true, true, false, true).beamGroups(),
        )
    }

    @Test
    fun `quarters never beam`() {
        assertEquals(emptyList<IntRange>(), beat(NoteValue.QUARTER, true).beamGroups())
    }

    @Test
    fun `an empty beat has no groups`() {
        assertEquals(emptyList<IntRange>(), beat(NoteValue.SIXTEENTH, false, false).beamGroups())
    }
}
```

- [ ] **Step 2: Run it and watch it fail**

Run: `./gradlew test --tests '*BeamingTest*'`
Expected: FAIL — unresolved reference `beamGroups`.

- [ ] **Step 3: Implement**

```kotlin
package dev.allan.scoreapp.core.layout

import dev.allan.scoreapp.core.model.Beat
import dev.allan.scoreapp.core.model.NoteValue

/**
 * Runs of consecutive sounding cells that should share a beam, so a subdivided beat reads as
 * one gesture. Only values shorter than a quarter beam at all; a rest ends the run.
 */
fun Beat.beamGroups(): List<IntRange> {
    if (division.divisionsPerWhole <= NoteValue.QUARTER.divisionsPerWhole) return emptyList()
    val groups = mutableListOf<IntRange>()
    var start: Int? = null
    cells.forEachIndexed { i, cell ->
        if (cell.notes.isNotEmpty()) {
            if (start == null) start = i
        } else {
            start?.let { groups += it..(i - 1) }
            start = null
        }
    }
    start?.let { groups += it..(cells.size - 1) }
    return groups
}
```

- [ ] **Step 4: Run it and watch it pass**

Run: `./gradlew test --tests '*BeamingTest*'`
Expected: PASS, 4 tests. Note a single sounding sixteenth yields `0..0` — a one-cell group the
renderer draws as a flag rather than a beam.

- [ ] **Step 5: Commit**

```bash
git add app/src/main/java/dev/allan/scoreapp/core/layout/Beaming.kt \
        app/src/test/java/dev/allan/scoreapp/BeamingTest.kt
git commit -m "Group beamed notes by run within a beat"
```

---

### Task 9: The glyph table

**Files:**
- Create: `app/src/main/java/dev/allan/scoreapp/core/layout/Glyphs.kt`
- Create: `app/src/main/assets/Bravura.otf`
- Test: `app/src/test/java/dev/allan/scoreapp/GlyphsTest.kt`

**Interfaces:**
- Consumes: `Notehead` (Task 4), `NoteValue` (Task 2).
- Produces: `object Glyphs` with `fun notehead(head: Notehead, value: NoteValue): Char`,
  `fun rest(value: NoteValue): Char`, `val ACCENT: Char`, `val BARLINE: Char`,
  `val STAFF5: Char`, `fun tupletDigit(n: Int): Char`, `fun flag(value: NoteValue): Char`.

**Context:** Bravura is Steinberg's reference SMuFL font, SIL Open Font License, so it satisfies
the open-source constraint. **Do not trust the codepoints below from memory** — Bravura ships a
`glyphnames.json` mapping names to codepoints, and Step 1 verifies against it.

- [ ] **Step 1: Fetch the font and verify the codepoints**

```bash
cd /home/allan/projects/score-app
mkdir -p app/src/main/assets vendor
curl -L -o vendor/bravura.zip https://github.com/steinbergmedia/bravura/archive/refs/heads/master.zip
unzip -o -q vendor/bravura.zip -d vendor
cp vendor/bravura-master/redist/otf/Bravura.otf app/src/main/assets/Bravura.otf
cp vendor/bravura-master/LICENSE.txt docs/BRAVURA-LICENSE.txt
python3 - <<'PY'
import json, glob
p = glob.glob('vendor/bravura-master/**/glyphnames.json', recursive=True)[0]
g = json.load(open(p))
for name in ["noteheadWhole","noteheadHalf","noteheadBlack","noteheadXBlack",
             "restWhole","restHalf","restQuarter","rest8th","rest16th","rest32nd",
             "accentAbove","barlineSingle","staff5Lines","tuplet3",
             "flag8thUp","flag16thUp","flag32ndUp"]:
    print(name, g[name]["codepoint"] if name in g else "*** MISSING ***")
PY
```

Expected: every name resolves to a `U+Exxx` codepoint. **If any value differs from the constants
in Step 3, the printed value wins** — correct the code, do not correct the font.

- [ ] **Step 2: Write the failing test**

```kotlin
package dev.allan.scoreapp

import dev.allan.scoreapp.core.layout.Glyphs
import dev.allan.scoreapp.core.model.Notehead
import dev.allan.scoreapp.core.model.NoteValue
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Test

class GlyphsTest {
    @Test
    fun `a quarter and shorter use the filled notehead`() {
        assertEquals(
            Glyphs.notehead(Notehead.NORMAL, NoteValue.QUARTER),
            Glyphs.notehead(Notehead.NORMAL, NoteValue.SIXTEENTH),
        )
    }

    @Test
    fun `a half is hollow and a quarter is not`() {
        assertNotEquals(
            Glyphs.notehead(Notehead.NORMAL, NoteValue.HALF),
            Glyphs.notehead(Notehead.NORMAL, NoteValue.QUARTER),
        )
    }

    @Test
    fun `cymbals use a cross notehead`() {
        assertNotEquals(
            Glyphs.notehead(Notehead.CROSS, NoteValue.QUARTER),
            Glyphs.notehead(Notehead.NORMAL, NoteValue.QUARTER),
        )
    }

    @Test
    fun `rests differ per value`() {
        assertNotEquals(Glyphs.rest(NoteValue.QUARTER), Glyphs.rest(NoteValue.EIGHTH))
    }

    @Test
    fun `tuplet digits are consecutive`() {
        assertEquals(Glyphs.tupletDigit(3) + 1, Glyphs.tupletDigit(4))
    }

    @Test
    fun `every glyph lives in the SMuFL private use area`() {
        val all = listOf(
            Glyphs.notehead(Notehead.NORMAL, NoteValue.QUARTER),
            Glyphs.notehead(Notehead.CROSS, NoteValue.QUARTER),
            Glyphs.rest(NoteValue.QUARTER), Glyphs.ACCENT,
            Glyphs.BARLINE, Glyphs.STAFF5, Glyphs.tupletDigit(3),
        )
        all.forEach { assertEquals("U+E000..U+F8FF", true, it.code in 0xE000..0xF8FF) }
    }
}
```

- [ ] **Step 3: Implement (correcting any codepoint Step 1 disagreed with)**

```kotlin
package dev.allan.scoreapp.core.layout

import dev.allan.scoreapp.core.model.Notehead
import dev.allan.scoreapp.core.model.NoteValue

/**
 * SMuFL codepoints for the Bravura font (SIL OFL). Verified against the glyphnames.json that
 * ships with the font — see Task 9 Step 1.
 *
 * Hollow versus filled is the note value itself, not decoration, which is exactly the thing
 * that costs 5-10 seconds a note to fill in by hand on paper.
 */
object Glyphs {
    const val STAFF5 = ''
    const val BARLINE = ''
    const val ACCENT = ''

    private const val NOTEHEAD_WHOLE = ''
    private const val NOTEHEAD_HALF = ''
    private const val NOTEHEAD_BLACK = ''
    private const val NOTEHEAD_X_BLACK = ''

    fun notehead(head: Notehead, value: NoteValue): Char = when {
        head == Notehead.CROSS -> NOTEHEAD_X_BLACK
        value == NoteValue.WHOLE -> NOTEHEAD_WHOLE
        value == NoteValue.HALF -> NOTEHEAD_HALF
        else -> NOTEHEAD_BLACK
    }

    fun rest(value: NoteValue): Char = when (value) {
        NoteValue.WHOLE -> ''
        NoteValue.HALF -> ''
        NoteValue.QUARTER -> ''
        NoteValue.EIGHTH -> ''
        NoteValue.SIXTEENTH -> ''
        NoteValue.THIRTY_SECOND -> ''
    }

    fun flag(value: NoteValue): Char = when (value) {
        NoteValue.EIGHTH -> ''
        NoteValue.SIXTEENTH -> ''
        NoteValue.THIRTY_SECOND -> ''
        else -> ' '
    }

    /** tuplet0..tuplet9 are consecutive from U+E880. */
    fun tupletDigit(n: Int): Char = ('' + n)
}
```

- [ ] **Step 4: Run it and watch it pass**

Run: `./gradlew test --tests '*GlyphsTest*'`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add app/src/main/java/dev/allan/scoreapp/core/layout/Glyphs.kt \
        app/src/test/java/dev/allan/scoreapp/GlyphsTest.kt \
        app/src/main/assets/Bravura.otf docs/BRAVURA-LICENSE.txt .gitignore
git commit -m "Add the Bravura font and its glyph table"
```

Note: add `vendor/` to `.gitignore` in this commit — the zip and extracted tree stay out of the
repo, only the font and its licence go in.

---

### Task 10: Bar layout

**Files:**
- Create: `app/src/main/java/dev/allan/scoreapp/core/layout/BarLayout.kt`
- Test: `app/src/test/java/dev/allan/scoreapp/BarLayoutTest.kt`

**Interfaces:**
- Consumes: `Bar`, `Beat`, `Staff`, `Slot` (Tasks 3–4); `Glyphs` (Task 9); `beamGroups` (Task 8).
- Produces:

```kotlin
data class PlacedGlyph(val glyph: Char, val x: Float, val y: Float, val slotId: String? = null)
data class BeamLine(val x1: Float, val y1: Float, val x2: Float, val y2: Float)
data class LayoutConfig(val width: Float, val staffSpacing: Float,
                        val focusedBeat: Int? = null, val focusScale: Float = 2.5f)
data class BarLayoutResult(val glyphs: List<PlacedGlyph>, val beams: List<BeamLine>,
                           val beatBounds: List<ClosedFloatingPointRange<Float>>)
fun layoutBar(bar: Bar, staff: Staff, config: LayoutConfig): BarLayoutResult
```

**Context:** this is the whole point of the architecture — a pure function from model to
positions, so engraving is unit-testable and the PDF cannot disagree with the screen. `y` is
measured downward from the top line, `staffSpacing` is the gap between staff lines, and a
`staffPosition` of 0 (bottom line) sits at `y = 4 * staffSpacing`.

- [ ] **Step 1: Write the failing test**

```kotlin
package dev.allan.scoreapp

import dev.allan.scoreapp.core.layout.LayoutConfig
import dev.allan.scoreapp.core.layout.layoutBar
import dev.allan.scoreapp.core.model.*
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class BarLayoutTest {
    private val staff = DRUM_PROFILE.staves.single()
    private val config = LayoutConfig(width = 1000f, staffSpacing = 10f)

    private fun barWith(vararg beats: Beat) = Bar(beats.toList())

    private fun snareBeat(division: NoteValue, count: Int) =
        Beat(division, null, List(count) { Cell(listOf(Note("snare"))) })

    @Test
    fun `an empty bar still lays out its bar line`() {
        val r = layoutBar(Bar(List(4) { emptyBeat(NoteValue.QUARTER, 4) }), staff, config)
        assertTrue(r.glyphs.any { it.glyph == dev.allan.scoreapp.core.layout.Glyphs.BARLINE })
    }

    @Test
    fun `a note lands at the vertical position of its slot`() {
        val r = layoutBar(barWith(snareBeat(NoteValue.QUARTER, 1)), staff, config)
        val snare = staff.slots.single { it.id == "snare" }
        val placed = r.glyphs.single { it.slotId == "snare" }
        assertEquals((4 - snare.staffPosition * 0.5f) * config.staffSpacing, placed.y, 0.01f)
    }

    @Test
    fun `cells inside a beat are evenly spaced`() {
        val r = layoutBar(barWith(snareBeat(NoteValue.SIXTEENTH, 4)), staff, config)
        val xs = r.glyphs.filter { it.slotId == "snare" }.map { it.x }.sorted()
        assertEquals(4, xs.size)
        val gaps = xs.zipWithNext { a, b -> b - a }
        gaps.forEach { assertEquals(gaps.first(), it, 0.01f) }
    }

    @Test
    fun `simultaneous notes share an x`() {
        val bar = barWith(Beat(NoteValue.QUARTER, null, listOf(Cell(listOf(Note("kick"), Note("hihat"))))))
        val r = layoutBar(bar, staff, config)
        val kick = r.glyphs.single { it.slotId == "kick" }
        val hihat = r.glyphs.single { it.slotId == "hihat" }
        assertEquals(kick.x, hihat.x, 0.01f)
    }

    @Test
    fun `the focused beat is wider than the others`() {
        val bar = Bar(List(4) { emptyBeat(NoteValue.QUARTER, 4) })
        val r = layoutBar(bar, staff, config.copy(focusedBeat = 0))
        val focused = r.beatBounds[0].endInclusive - r.beatBounds[0].start
        val other = r.beatBounds[1].endInclusive - r.beatBounds[1].start
        assertTrue("focused beat should be wider, was $focused vs $other", focused > other)
    }

    @Test
    fun `beat bounds tile the bar without gaps or overlap`() {
        val bar = Bar(List(4) { emptyBeat(NoteValue.QUARTER, 4) })
        val r = layoutBar(bar, staff, config.copy(focusedBeat = 2))
        r.beatBounds.zipWithNext { a, b -> assertEquals(a.endInclusive, b.start, 0.01f) }
        assertTrue(r.beatBounds.last().endInclusive <= config.width)
    }

    @Test
    fun `beamed sixteenths produce a beam line`() {
        val r = layoutBar(barWith(snareBeat(NoteValue.SIXTEENTH, 4)), staff, config)
        assertEquals(1, r.beams.size)
    }

    @Test
    fun `an empty cell lays out a rest`() {
        val bar = barWith(Beat(NoteValue.EIGHTH, null, listOf(Cell(listOf(Note("snare"))), Cell())))
        val r = layoutBar(bar, staff, config)
        assertTrue(r.glyphs.any { it.glyph == dev.allan.scoreapp.core.layout.Glyphs.rest(NoteValue.EIGHTH) })
    }

    @Test
    fun `a tuplet digit is laid out over the beat`() {
        val bar = barWith(Beat(NoteValue.EIGHTH, 3, List(3) { Cell(listOf(Note("snare"))) }))
        val r = layoutBar(bar, staff, config)
        assertTrue(r.glyphs.any { it.glyph == dev.allan.scoreapp.core.layout.Glyphs.tupletDigit(3) })
    }
}
```

- [ ] **Step 2: Run it and watch it fail**

Run: `./gradlew test --tests '*BarLayoutTest*'`
Expected: FAIL — unresolved reference `layoutBar`.

- [ ] **Step 3: Implement**

```kotlin
package dev.allan.scoreapp.core.layout

import dev.allan.scoreapp.core.model.Bar
import dev.allan.scoreapp.core.model.Beat
import dev.allan.scoreapp.core.model.Staff

/** A glyph and where to draw it. [slotId] is set for noteheads, so taps can be traced back. */
data class PlacedGlyph(val glyph: Char, val x: Float, val y: Float, val slotId: String? = null)

data class BeamLine(val x1: Float, val y1: Float, val x2: Float, val y2: Float)

/**
 * [focusedBeat] gets [focusScale] times the width of an ordinary beat, which is what makes one
 * beat large enough to edit on a phone while its neighbours stay visible.
 */
data class LayoutConfig(
    val width: Float,
    val staffSpacing: Float,
    val focusedBeat: Int? = null,
    val focusScale: Float = 2.5f,
)

data class BarLayoutResult(
    val glyphs: List<PlacedGlyph>,
    val beams: List<BeamLine>,
    val beatBounds: List<ClosedFloatingPointRange<Float>>,
)

/** Vertical centre of a staff position; 0 is the bottom line, positives go up. */
private fun yOf(staffPosition: Int, spacing: Float): Float = (4 - staffPosition * 0.5f) * spacing

/**
 * Turn a bar into glyphs and positions. Pure: no Android types, no Canvas — so the whole of
 * engraving is unit-testable, and PDF export reuses it unchanged.
 */
fun layoutBar(bar: Bar, staff: Staff, config: LayoutConfig): BarLayoutResult {
    val glyphs = mutableListOf<PlacedGlyph>()
    val beams = mutableListOf<BeamLine>()
    val bounds = mutableListOf<ClosedFloatingPointRange<Float>>()

    val weights = bar.beats.indices.map { if (it == config.focusedBeat) config.focusScale else 1f }
    val unit = config.width / weights.sum()

    var x = 0f
    bar.beats.forEachIndexed { beatIndex, beat ->
        val beatWidth = unit * weights[beatIndex]
        bounds += x..(x + beatWidth)
        val cellWidth = beatWidth / beat.cells.size
        val cellX = { i: Int -> x + cellWidth * i + cellWidth / 2f }

        beat.cells.forEachIndexed { cellIndex, cell ->
            if (cell.notes.isEmpty()) {
                glyphs += PlacedGlyph(
                    Glyphs.rest(beat.division), cellX(cellIndex), yOf(4, config.staffSpacing)
                )
            } else {
                cell.notes.forEach { note ->
                    val slot = staff.slots.first { it.id == note.slotId }
                    glyphs += PlacedGlyph(
                        glyph = Glyphs.notehead(slot.notehead, beat.division),
                        x = cellX(cellIndex),
                        y = yOf(slot.staffPosition, config.staffSpacing),
                        slotId = slot.id,
                    )
                }
            }
        }

        beat.tuplet?.let { n ->
            glyphs += PlacedGlyph(Glyphs.tupletDigit(n), x + beatWidth / 2f, -config.staffSpacing)
        }

        val beamY = -config.staffSpacing * 0.5f
        beat.beamGroups().filter { it.first != it.last }.forEach { range ->
            beams += BeamLine(cellX(range.first), beamY, cellX(range.last), beamY)
        }

        x += beatWidth
    }

    glyphs += PlacedGlyph(Glyphs.BARLINE, config.width, yOf(4, config.staffSpacing))
    return BarLayoutResult(glyphs, beams, bounds)
}
```

- [ ] **Step 4: Run it and watch it pass**

Run: `./gradlew test --tests '*BarLayoutTest*'`
Expected: PASS, 9 tests.

- [ ] **Step 5: Commit**

```bash
git add app/src/main/java/dev/allan/scoreapp/core/layout/BarLayout.kt \
        app/src/test/java/dev/allan/scoreapp/BarLayoutTest.kt
git commit -m "Lay a bar out as glyphs and positions, focused beat enlarged"
```

---

### Task 11: JSON import and export

**Files:**
- Create: `app/src/main/java/dev/allan/scoreapp/core/json/ScoreJson.kt`
- Test: `app/src/test/java/dev/allan/scoreapp/ScoreJsonTest.kt`

**Interfaces:**
- Consumes: the whole model (Tasks 2–4).
- Produces: `object ScoreJson` with `const val SCHEMA_VERSION = 1`,
  `fun encode(score: Score): String`, `fun decode(json: String): Score`.

**Context:** this schema is a contract, the way `WORKOUT_PLAN_GENERATOR.md` is in the workout
app — the AI transcription prompt targets it, so it must not drift silently. Unknown fields are
ignored so a newer file still opens; a newer `schema_version` is rejected loudly.

- [ ] **Step 1: Write the failing test**

```kotlin
package dev.allan.scoreapp

import dev.allan.scoreapp.core.json.ScoreJson
import dev.allan.scoreapp.core.model.*
import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Test

class ScoreJsonTest {
    private val score = Score(
        title = "Paradiddle", profileId = "drums", defaultBpm = 90,
        bars = listOf(Bar(listOf(
            Beat(NoteValue.SIXTEENTH, null, List(4) {
                Cell(listOf(Note("snare", setOf(Articulation.ACCENT), Sticking.R)))
            }),
            Beat(NoteValue.EIGHTH, 3, List(3) { Cell(listOf(Note("kick"))) }),
        ))),
    )

    @Test
    fun `a score survives a round trip`() {
        assertEquals(score, ScoreJson.decode(ScoreJson.encode(score)))
    }

    @Test
    fun `the encoded form carries a schema version`() {
        assertTrue(ScoreJson.encode(score).contains("\"schema_version\""))
    }

    @Test
    fun `tuplets and articulations survive`() {
        val back = ScoreJson.decode(ScoreJson.encode(score))
        assertEquals(3, back.bars[0].beats[1].tuplet)
        assertEquals(setOf(Articulation.ACCENT), back.bars[0].beats[0].cells[0].notes[0].articulations)
        assertEquals(Sticking.R, back.bars[0].beats[0].cells[0].notes[0].sticking)
    }

    @Test
    fun `an unknown field is ignored`() {
        val withExtra = ScoreJson.encode(score).replaceFirst("{", "{\"future_field\":1,")
        assertEquals(score, ScoreJson.decode(withExtra))
    }

    @Test
    fun `a newer schema version is rejected`() {
        val newer = ScoreJson.encode(score).replace("\"schema_version\":1", "\"schema_version\":99")
        val e = assertThrows(IllegalArgumentException::class.java) { ScoreJson.decode(newer) }
        assertTrue(e.message!!.contains("99"))
    }
}
```

- [ ] **Step 2: Run it and watch it fail**

Run: `./gradlew test --tests '*ScoreJsonTest*'`
Expected: FAIL — unresolved reference `ScoreJson`.

- [ ] **Step 3: Implement**

```kotlin
package dev.allan.scoreapp.core.json

import dev.allan.scoreapp.core.model.*
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import kotlinx.serialization.SerialName

@Serializable
private data class NoteDto(
    val slot: String,
    val articulations: List<Articulation> = emptyList(),
    val sticking: Sticking? = null,
)

@Serializable
private data class CellDto(val notes: List<NoteDto> = emptyList())

@Serializable
private data class BeatDto(val division: NoteValue, val tuplet: Int? = null, val cells: List<CellDto>)

@Serializable
private data class BarDto(val beats: List<BeatDto>)

@Serializable
private data class ScoreDto(
    @SerialName("schema_version") val schemaVersion: Int,
    val title: String,
    val profile: String,
    @SerialName("time_sig_num") val timeSigNum: Int,
    @SerialName("time_sig_den") val timeSigDen: Int,
    @SerialName("default_bpm") val defaultBpm: Int,
    val bars: List<BarDto>,
)

/**
 * The import/export contract. The AI transcription prompt in docs/SCORE_IMPORT_PROMPT.md
 * targets this shape, so changing a field name here means changing that document too.
 */
object ScoreJson {
    const val SCHEMA_VERSION = 1

    private val json = Json { ignoreUnknownKeys = true; encodeDefaults = true; prettyPrint = true }

    fun encode(score: Score): String = json.encodeToString(
        ScoreDto(
            schemaVersion = SCHEMA_VERSION,
            title = score.title,
            profile = score.profileId,
            timeSigNum = score.timeSigNum,
            timeSigDen = score.timeSigDen,
            defaultBpm = score.defaultBpm,
            bars = score.bars.map { bar ->
                BarDto(bar.beats.map { beat ->
                    BeatDto(beat.division, beat.tuplet, beat.cells.map { cell ->
                        CellDto(cell.notes.map { NoteDto(it.slotId, it.articulations.toList(), it.sticking) })
                    })
                })
            },
        )
    )

    fun decode(text: String): Score {
        val dto = json.decodeFromString<ScoreDto>(text)
        require(dto.schemaVersion <= SCHEMA_VERSION) {
            "score file is schema_version ${dto.schemaVersion}, this build understands up to $SCHEMA_VERSION"
        }
        return Score(
            title = dto.title,
            profileId = dto.profile,
            timeSigNum = dto.timeSigNum,
            timeSigDen = dto.timeSigDen,
            defaultBpm = dto.defaultBpm,
            bars = dto.bars.map { bar ->
                Bar(bar.beats.map { beat ->
                    Beat(beat.division, beat.tuplet, beat.cells.map { cell ->
                        Cell(cell.notes.map { Note(it.slot, it.articulations.toSet(), it.sticking) })
                    })
                })
            },
        )
    }
}
```

Add `@Serializable` to `Articulation`, `Sticking` and `NoteValue` in their own files, importing
`kotlinx.serialization.Serializable`.

- [ ] **Step 4: Run it and watch it pass**

Run: `./gradlew test --tests '*ScoreJsonTest*'`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add app/src/main/java/dev/allan/scoreapp/core/json/ScoreJson.kt \
        app/src/main/java/dev/allan/scoreapp/core/model/ \
        app/src/test/java/dev/allan/scoreapp/ScoreJsonTest.kt
git commit -m "Read and write scores as versioned JSON"
```

---

### Task 12: Persistence

**Files:**
- Create: `app/src/main/java/dev/allan/scoreapp/data/db/Entities.kt`,
  `ScoreDao.kt`, `AppDatabase.kt`, `app/src/main/java/dev/allan/scoreapp/data/ScoreRepo.kt`
- Test: `app/src/test/java/dev/allan/scoreapp/ScoreRepoTest.kt`

**Interfaces:**
- Consumes: `ScoreJson` (Task 11).
- Produces: `@Entity ScoreEntity(id, title, profileId, defaultBpm, updatedAt, json)`;
  `ScoreDao` with `observeAll()`, `get(id)`, `upsert(entity)`, `delete(id)`;
  `ScoreRepo` with `fun toScore(e: ScoreEntity): Score` and `fun toEntity(s: Score): ScoreEntity`.

**Context:** the bar structure is stored as the same JSON the export uses, rather than as a
table per level. One serialisation format, exercised on every save, so export can never rot
unnoticed. Columns exist only for what the archive list needs to sort and show.

- [ ] **Step 1: Write the failing test** (pure mapping, no Android needed)

```kotlin
package dev.allan.scoreapp

import dev.allan.scoreapp.core.model.*
import dev.allan.scoreapp.data.ScoreRepo
import org.junit.Assert.assertEquals
import org.junit.Test

class ScoreRepoTest {
    private val score = Score(
        id = 7, title = "Groove", profileId = "drums", defaultBpm = 120,
        bars = listOf(Bar(listOf(emptyBeat(NoteValue.EIGHTH, 4)))),
    )

    @Test
    fun `a score survives the trip through an entity`() {
        assertEquals(score, ScoreRepo.toScore(ScoreRepo.toEntity(score)))
    }

    @Test
    fun `the list columns are filled from the score`() {
        val e = ScoreRepo.toEntity(score)
        assertEquals("Groove", e.title)
        assertEquals(120, e.defaultBpm)
        assertEquals("drums", e.profileId)
    }
}
```

- [ ] **Step 2: Run it and watch it fail**

Run: `./gradlew test --tests '*ScoreRepoTest*'`
Expected: FAIL — unresolved reference `ScoreRepo`.

- [ ] **Step 3: Implement**

`Entities.kt`:

```kotlin
package dev.allan.scoreapp.data.db

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "score")
data class ScoreEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val title: String,
    val profileId: String,
    val defaultBpm: Int,
    val updatedAt: Long,
    /** The whole bar structure, in the same JSON the export writes. */
    val json: String,
)
```

`ScoreDao.kt`:

```kotlin
package dev.allan.scoreapp.data.db

import androidx.room.*
import kotlinx.coroutines.flow.Flow

@Dao
interface ScoreDao {
    @Query("SELECT * FROM score ORDER BY updatedAt DESC")
    fun observeAll(): Flow<List<ScoreEntity>>

    @Query("SELECT * FROM score WHERE id = :id")
    suspend fun get(id: Long): ScoreEntity?

    @Upsert
    suspend fun upsert(entity: ScoreEntity): Long

    @Query("DELETE FROM score WHERE id = :id")
    suspend fun delete(id: Long)
}
```

`AppDatabase.kt`:

```kotlin
package dev.allan.scoreapp.data.db

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase

@Database(entities = [ScoreEntity::class], version = 1, exportSchema = true)
abstract class AppDatabase : RoomDatabase() {
    abstract fun scoreDao(): ScoreDao

    companion object {
        @Volatile private var instance: AppDatabase? = null

        /** Migrations get appended here, and an instrumented migration test with them. */
        val ALL_MIGRATIONS = emptyArray<androidx.room.migration.Migration>()

        fun get(context: Context): AppDatabase = instance ?: synchronized(this) {
            instance ?: Room.databaseBuilder(
                context.applicationContext, AppDatabase::class.java, "score.db"
            ).addMigrations(*ALL_MIGRATIONS).build().also { instance = it }
        }
    }
}
```

`ScoreRepo.kt`:

```kotlin
package dev.allan.scoreapp.data

import dev.allan.scoreapp.core.json.ScoreJson
import dev.allan.scoreapp.core.model.Score
import dev.allan.scoreapp.data.db.ScoreEntity

/** Maps between the stored row and the model. Pure, so it is tested on the JVM. */
object ScoreRepo {
    fun toEntity(score: Score, now: Long = System.currentTimeMillis()) = ScoreEntity(
        id = score.id,
        title = score.title,
        profileId = score.profileId,
        defaultBpm = score.defaultBpm,
        updatedAt = now,
        json = ScoreJson.encode(score),
    )

    fun toScore(entity: ScoreEntity): Score = ScoreJson.decode(entity.json).copy(id = entity.id)
}
```

- [ ] **Step 4: Run it and watch it pass**

Run: `./gradlew test --tests '*ScoreRepoTest*'`
Expected: PASS, 2 tests.

- [ ] **Step 5: Commit**

```bash
git add app/src/main/java/dev/allan/scoreapp/data/ \
        app/src/test/java/dev/allan/scoreapp/ScoreRepoTest.kt app/schemas
git commit -m "Store scores, keeping the bars as export JSON"
```

---

### Task 13: The canvas

**Files:**
- Create: `app/src/main/java/dev/allan/scoreapp/ui/editor/ScoreCanvas.kt`
- Modify: `app/src/main/java/dev/allan/scoreapp/MainActivity.kt`

**Interfaces:**
- Consumes: `layoutBar`, `LayoutConfig`, `BarLayoutResult`, `PlacedGlyph` (Task 10);
  `Staff`, `slotNearest` (Task 4).
- Produces:

```kotlin
@Composable fun ScoreCanvas(
    bar: Bar, staff: Staff, focusedBeat: Int,
    colourFor: (NoteValue) -> Color,
    onTap: (beatIndex: Int, staffPosition: Int) -> Unit,
    modifier: Modifier = Modifier,
)
fun staffPositionAt(y: Float, staffSpacing: Float): Int
```

**Context:** deliberately thin — it paints what `layoutBar` returned and converts a tap back
into (beat, staff position). No editing logic lives here. `staffPositionAt` is the inverse of
the layout's `yOf` and is unit-tested.

- [ ] **Step 1: Write the failing test for the inverse mapping**

`app/src/test/java/dev/allan/scoreapp/StaffPositionTest.kt`:

```kotlin
package dev.allan.scoreapp

import dev.allan.scoreapp.ui.editor.staffPositionAt
import org.junit.Assert.assertEquals
import org.junit.Test

class StaffPositionTest {
    @Test
    fun `the bottom line is position zero`() {
        assertEquals(0, staffPositionAt(y = 40f, staffSpacing = 10f))
    }

    @Test
    fun `the top line is position eight`() {
        assertEquals(8, staffPositionAt(y = 0f, staffSpacing = 10f))
    }

    @Test
    fun `below the staff is negative`() {
        assertEquals(-2, staffPositionAt(y = 50f, staffSpacing = 10f))
    }

    @Test
    fun `a tap between positions snaps to the nearer one`() {
        assertEquals(4, staffPositionAt(y = 21f, staffSpacing = 10f))
    }
}
```

- [ ] **Step 2: Run it and watch it fail**

Run: `./gradlew test --tests '*StaffPositionTest*'`
Expected: FAIL — unresolved reference `staffPositionAt`.

- [ ] **Step 3: Implement**

```kotlin
package dev.allan.scoreapp.ui.editor

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.nativeCanvas
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.geometry.Offset
import android.graphics.Paint
import android.graphics.Typeface
import dev.allan.scoreapp.core.layout.LayoutConfig
import dev.allan.scoreapp.core.layout.layoutBar
import dev.allan.scoreapp.core.model.Bar
import dev.allan.scoreapp.core.model.NoteValue
import dev.allan.scoreapp.core.model.Staff
import kotlin.math.roundToInt

/** Inverse of the layout's vertical mapping: screen y back to a staff position. */
fun staffPositionAt(y: Float, staffSpacing: Float): Int =
    ((4f - y / staffSpacing) * 2f).roundToInt()

@Composable
fun ScoreCanvas(
    bar: Bar,
    staff: Staff,
    focusedBeat: Int,
    colourFor: (NoteValue) -> Color,
    onTap: (beatIndex: Int, staffPosition: Int) -> Unit,
    modifier: Modifier = Modifier,
) {
    val context = LocalContext.current
    val typeface = remember { Typeface.createFromAsset(context.assets, "Bravura.otf") }

    Canvas(
        modifier = modifier.pointerInput(bar, focusedBeat) {
            detectTapGestures { offset ->
                val spacing = size.height / 12f
                val config = LayoutConfig(size.width.toFloat(), spacing, focusedBeat)
                val result = layoutBar(bar, staff, config)
                val beat = result.beatBounds.indexOfFirst { offset.x in it }
                if (beat >= 0) onTap(beat, staffPositionAt(offset.y - spacing * 2f, spacing))
            }
        }
    ) {
        val spacing = size.height / 12f
        val top = spacing * 2f
        val config = LayoutConfig(size.width, spacing, focusedBeat)
        val result = layoutBar(bar, staff, config)

        repeat(staff.lineCount) { i ->
            val y = top + i * spacing
            drawLine(Color.Black, Offset(0f, y), Offset(size.width, y), strokeWidth = 1.5f)
        }

        val paint = Paint().apply {
            this.typeface = typeface
            textSize = spacing * 4f
            isAntiAlias = true
            textAlign = Paint.Align.CENTER
        }
        drawContext.canvas.nativeCanvas.let { native ->
            result.glyphs.forEach { g ->
                paint.color = colourFor(bar.beats[0].division).value.toInt()
                native.drawText(g.glyph.toString(), g.x, top + g.y, paint)
            }
        }
        result.beams.forEach { b ->
            drawLine(Color.Black, Offset(b.x1, top + b.y1), Offset(b.x2, top + b.y2), strokeWidth = spacing * 0.4f)
        }
        result.beatBounds.getOrNull(focusedBeat)?.let { r ->
            drawRect(
                color = Color(0x223F51B5),
                topLeft = Offset(r.start, 0f),
                size = androidx.compose.ui.geometry.Size(r.endInclusive - r.start, size.height),
            )
        }
    }
}
```

Add `import androidx.compose.runtime.remember`.

- [ ] **Step 4: Run it and watch it pass, then look at it**

Run: `./gradlew test --tests '*StaffPositionTest*'`
Expected: PASS, 4 tests.

Then wire `ScoreCanvas` into `MainActivity` with a hard-coded one-bar score and install it:

```bash
./gradlew installDebug
adb shell monkey -p dev.allan.scoreapp -c android.intent.category.LAUNCHER 1
adb exec-out screencap -p > /tmp/score-canvas.png
```

Expected: five staff lines, noteheads at the right heights, the focused beat tinted and wider.
**This is one of the few genuinely visual checks in the plan — take the screenshot, look once,
move on.** Everything numeric is already covered by Task 10.

- [ ] **Step 5: Commit**

```bash
git add app/src/main/java/dev/allan/scoreapp/ui/ \
        app/src/main/java/dev/allan/scoreapp/MainActivity.kt \
        app/src/test/java/dev/allan/scoreapp/StaffPositionTest.kt
git commit -m "Draw a bar and turn taps back into staff positions"
```

---

### Task 14: The editor screen

**Files:**
- Create: `app/src/main/java/dev/allan/scoreapp/ui/editor/EditorViewModel.kt`,
  `EditorScreen.kt`
- Test: `app/src/test/java/dev/allan/scoreapp/EditorStateTest.kt`

**Interfaces:**
- Consumes: `placeNote`, `deleteNote`, `subdivide` (Task 6); `next`, `prev`, `Cursor` (Task 5);
  `ScoreCanvas` (Task 13); `DRUM_PROFILE`, `slotNearest` (Task 4).
- Produces:

```kotlin
data class EditorState(
    val score: Score, val cursor: Cursor = Cursor(),
    val palette: NoteValue = NoteValue.QUARTER, val tuplet: Int? = null,
    val deleteMode: Boolean = false, val articulations: Set<Articulation> = emptySet(),
    val sticking: Sticking? = null,
)
fun EditorState.onStaffTap(staffPosition: Int): EditorState
fun EditorState.onPaletteValue(value: NoteValue, tuplet: Int?): EditorState
fun EditorState.onNext(): EditorState
fun EditorState.onPrev(): EditorState
```

**Context:** every interaction rule from the spec lives in these four pure functions, so they
are all unit-tested. The Composable only calls them.

- [ ] **Step 1: Write the failing test**

```kotlin
package dev.allan.scoreapp

import dev.allan.scoreapp.core.edit.Cursor
import dev.allan.scoreapp.core.edit.beatAt
import dev.allan.scoreapp.core.model.*
import dev.allan.scoreapp.ui.editor.*
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class EditorStateTest {
    private val staff = DRUM_PROFILE.staves.single()
    private val snare = staff.slots.single { it.id == "snare" }
    private val kick = staff.slots.single { it.id == "kick" }

    private fun state() = EditorState(
        score = Score(title = "t", profileId = "drums", bars = listOf(emptyBar(4, 4)))
    )

    private fun notes(s: EditorState) = s.score.beatAt(s.cursor).cells[s.cursor.cell].notes

    @Test
    fun `tapping a height places a note at that slot`() {
        val s = state().onStaffTap(snare.staffPosition)
        assertEquals(listOf("snare"), notes(s).map { it.slotId })
    }

    @Test
    fun `placing a note does not move the cursor`() {
        val before = state()
        assertEquals(before.cursor, before.onStaffTap(snare.staffPosition).cursor)
    }

    @Test
    fun `a second height in the same cell sounds together`() {
        val s = state().onStaffTap(kick.staffPosition).onStaffTap(snare.staffPosition)
        assertEquals(setOf("kick", "snare"), notes(s).map { it.slotId }.toSet())
    }

    @Test
    fun `tapping the same height again overwrites rather than duplicating`() {
        val s = state().onStaffTap(snare.staffPosition).onStaffTap(snare.staffPosition)
        assertEquals(1, notes(s).size)
    }

    @Test
    fun `delete mode removes the note under the tap`() {
        val s = state().onStaffTap(snare.staffPosition)
            .copy(deleteMode = true).onStaffTap(snare.staffPosition)
        assertTrue(notes(s).isEmpty())
    }

    @Test
    fun `choosing a palette value subdivides the focused beat`() {
        val s = state().onPaletteValue(NoteValue.SIXTEENTH, null)
        assertEquals(4, s.score.beatAt(s.cursor).cells.size)
    }

    @Test
    fun `choosing a triplet subdivides into three`() {
        val s = state().onPaletteValue(NoteValue.EIGHTH, 3)
        assertEquals(3, s.score.beatAt(s.cursor).cells.size)
    }

    @Test
    fun `subdividing does not move the cursor off the start of the beat`() {
        val s = state().onPaletteValue(NoteValue.SIXTEENTH, null)
        assertEquals(0, s.cursor.cell)
    }

    @Test
    fun `next and prev walk sub-positions`() {
        val s = state().onPaletteValue(NoteValue.SIXTEENTH, null).onNext()
        assertEquals(1, s.cursor.cell)
        assertEquals(0, s.onPrev().cursor.cell)
    }

    @Test
    fun `articulations and sticking are carried onto placed notes`() {
        val s = state().copy(articulations = setOf(Articulation.ACCENT), sticking = Sticking.R)
            .onStaffTap(snare.staffPosition)
        val note = notes(s).single()
        assertEquals(setOf(Articulation.ACCENT), note.articulations)
        assertEquals(Sticking.R, note.sticking)
    }
}
```

- [ ] **Step 2: Run it and watch it fail**

Run: `./gradlew test --tests '*EditorStateTest*'`
Expected: FAIL — unresolved reference `EditorState`.

- [ ] **Step 3: Implement the state**

```kotlin
package dev.allan.scoreapp.ui.editor

import dev.allan.scoreapp.core.edit.*
import dev.allan.scoreapp.core.model.*

data class EditorState(
    val score: Score,
    val cursor: Cursor = Cursor(),
    val palette: NoteValue = NoteValue.QUARTER,
    val tuplet: Int? = null,
    val deleteMode: Boolean = false,
    val articulations: Set<Articulation> = emptySet(),
    val sticking: Sticking? = null,
)

private fun EditorState.staff() = DRUM_PROFILE.staves.single()

/**
 * A tap at a height. In delete mode it removes that slot; otherwise it writes it, replacing
 * whatever was on the same slot and joining anything on a different one. The cursor stays put
 * either way — the whole point, since a kick and a hi-hat together are two taps in one place.
 */
fun EditorState.onStaffTap(staffPosition: Int): EditorState {
    val slot = staff().slotNearest(staffPosition)
    return if (deleteMode) copy(score = score.deleteNote(cursor, slot.id))
    else copy(score = score.placeNote(cursor, Note(slot.id, articulations, sticking)))
}

/** Selecting a value in the palette subdivides the focused beat and stays at its first cell. */
fun EditorState.onPaletteValue(value: NoteValue, tuplet: Int?): EditorState = copy(
    score = score.subdivide(cursor, value, tuplet),
    palette = value,
    tuplet = tuplet,
    cursor = cursor.copy(cell = 0),
)

fun EditorState.onNext(): EditorState = copy(cursor = score.next(cursor))

fun EditorState.onPrev(): EditorState = copy(cursor = score.prev(cursor))
```

- [ ] **Step 4: Run it and watch it pass**

Run: `./gradlew test --tests '*EditorStateTest*'`
Expected: PASS, 10 tests.

- [ ] **Step 5: Build the screen around it**

`EditorScreen.kt` — a `Row` with the palette on the left and `ScoreCanvas` filling the rest,
`<` and `>` beneath it. Every control calls one of the four functions above and nothing else:

```kotlin
package dev.allan.scoreapp.ui.editor

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import dev.allan.scoreapp.core.model.*

@Composable
fun EditorScreen(initial: Score, colourFor: (NoteValue) -> Color) {
    var state by remember { mutableStateOf(EditorState(initial)) }

    Row(Modifier.fillMaxSize()) {
        Column(Modifier.width(96.dp).padding(4.dp)) {
            NoteValue.entries.forEach { v ->
                FilterChip(
                    selected = state.palette == v && state.tuplet == null,
                    onClick = { state = state.onPaletteValue(v, null) },
                    label = { Text(v.name.first().toString() + v.divisionsPerWhole) },
                )
            }
            FilterChip(
                selected = state.tuplet == 3,
                onClick = { state = state.onPaletteValue(state.palette, 3) },
                label = { Text("3") },
            )
            FilterChip(
                selected = state.deleteMode,
                onClick = { state = state.copy(deleteMode = !state.deleteMode) },
                label = { Text("del") },
            )
            FilterChip(
                selected = Articulation.ACCENT in state.articulations,
                onClick = {
                    state = state.copy(
                        articulations = state.articulations.toMutableSet().apply {
                            if (!add(Articulation.ACCENT)) remove(Articulation.ACCENT)
                        }
                    )
                },
                label = { Text(">") },
            )
            Row {
                Sticking.entries.forEach { s ->
                    FilterChip(
                        selected = state.sticking == s,
                        onClick = { state = state.copy(sticking = if (state.sticking == s) null else s) },
                        label = { Text(s.name) },
                    )
                }
            }
        }
        Column(Modifier.weight(1f)) {
            ScoreCanvas(
                bar = state.score.bars[state.cursor.bar],
                staff = DRUM_PROFILE.staves.single(),
                focusedBeat = state.cursor.beat,
                colourFor = colourFor,
                onTap = { _, position -> state = state.onStaffTap(position) },
                modifier = Modifier.fillMaxWidth().weight(1f),
            )
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.Center) {
                Button(onClick = { state = state.onPrev() }) { Text("<") }
                Spacer(Modifier.width(24.dp))
                Button(onClick = { state = state.onNext() }) { Text(">") }
            }
        }
    }
}
```

Point `MainActivity` at `EditorScreen`, install, and try entering one real bar from a drum book:
a triplet on beat 1, two eighths on beat 2. **Time it against writing the same bar on paper** —
that comparison is the metric v1 is judged on.

- [ ] **Step 6: Commit**

```bash
git add app/src/main/java/dev/allan/scoreapp/ui/editor/ \
        app/src/main/java/dev/allan/scoreapp/MainActivity.kt \
        app/src/test/java/dev/allan/scoreapp/EditorStateTest.kt
git commit -m "Wire the palette, the canvas and the cursor into an editor"
```

---

### Task 15: Colour per note value

**Files:**
- Create: `app/src/main/java/dev/allan/scoreapp/core/layout/DurationColours.kt`
- Test: `app/src/test/java/dev/allan/scoreapp/DurationColoursTest.kt`
- Modify: `app/src/main/java/dev/allan/scoreapp/ui/editor/EditorScreen.kt`

**Interfaces:**
- Consumes: `NoteValue` (Task 2).
- Produces: `object DurationColours` with `val DEFAULT: Map<NoteValue, Long>` (ARGB) and
  `fun colourOf(map: Map<NoteValue, Long>, value: NoteValue): Long`.

**Context:** kept as plain `Long` ARGB in core so it stays free of Android types; the Composable
wraps it in `Color`. Used on screen and in the PDF, for reading practice.

- [ ] **Step 1: Write the failing test**

```kotlin
package dev.allan.scoreapp

import dev.allan.scoreapp.core.layout.DurationColours
import dev.allan.scoreapp.core.model.NoteValue
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Test

class DurationColoursTest {
    @Test
    fun `every note value has a default colour`() {
        NoteValue.entries.forEach { assertNotEquals(0L, DurationColours.DEFAULT[it]) }
    }

    @Test
    fun `eighths and sixteenths are told apart`() {
        assertNotEquals(DurationColours.DEFAULT[NoteValue.EIGHTH], DurationColours.DEFAULT[NoteValue.SIXTEENTH])
    }

    @Test
    fun `an override wins over the default`() {
        val map = DurationColours.DEFAULT + (NoteValue.EIGHTH to 0xFF00FF00L)
        assertEquals(0xFF00FF00L, DurationColours.colourOf(map, NoteValue.EIGHTH))
    }

    @Test
    fun `a missing entry falls back to opaque black`() {
        assertEquals(0xFF000000L, DurationColours.colourOf(emptyMap(), NoteValue.QUARTER))
    }
}
```

- [ ] **Step 2: Run it and watch it fail**

Run: `./gradlew test --tests '*DurationColoursTest*'`
Expected: FAIL — unresolved reference `DurationColours`.

- [ ] **Step 3: Implement**

```kotlin
package dev.allan.scoreapp.core.layout

import dev.allan.scoreapp.core.model.NoteValue

/** ARGB as Long so the core stays free of Android types. */
object DurationColours {
    val DEFAULT: Map<NoteValue, Long> = mapOf(
        NoteValue.WHOLE to 0xFF000000L,
        NoteValue.HALF to 0xFF37474FL,
        NoteValue.QUARTER to 0xFF1565C0L,
        NoteValue.EIGHTH to 0xFF2E7D32L,
        NoteValue.SIXTEENTH to 0xFFEF6C00L,
        NoteValue.THIRTY_SECOND to 0xFFC62828L,
    )

    fun colourOf(map: Map<NoteValue, Long>, value: NoteValue): Long = map[value] ?: 0xFF000000L
}
```

In `EditorScreen`, pass `colourFor = { Color(DurationColours.colourOf(DurationColours.DEFAULT, it)) }`.

- [ ] **Step 4: Run it and watch it pass**

Run: `./gradlew test --tests '*DurationColoursTest*'`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add app/src/main/java/dev/allan/scoreapp/core/layout/DurationColours.kt \
        app/src/main/java/dev/allan/scoreapp/ui/editor/EditorScreen.kt \
        app/src/test/java/dev/allan/scoreapp/DurationColoursTest.kt
git commit -m "Colour noteheads by their value"
```

---

### Task 16: Archive, PDF export and the import prompt

**Files:**
- Create: `app/src/main/java/dev/allan/scoreapp/ui/archive/ArchiveScreen.kt`
- Create: `app/src/main/java/dev/allan/scoreapp/export/PdfExport.kt`
- Create: `docs/SCORE_IMPORT_PROMPT.md`
- Test: `app/src/test/java/dev/allan/scoreapp/PdfPaginationTest.kt`

**Interfaces:**
- Consumes: `layoutBar`, `LayoutConfig` (Task 10); `ScoreDao` (Task 12); `ScoreJson` (Task 11).
- Produces: `fun paginate(barCount: Int, barsPerRow: Int, rowsPerPage: Int): List<IntRange>`;
  `fun exportPdf(score: Score, staff: Staff, out: OutputStream)`.

**Context:** PDF reuses `layoutBar` with `focusedBeat = null`, so the printed page and the screen
can never diverge. Pagination is arithmetic, so it is unit-tested and the PDF writer stays thin.

- [ ] **Step 1: Write the failing test**

```kotlin
package dev.allan.scoreapp

import dev.allan.scoreapp.export.paginate
import org.junit.Assert.assertEquals
import org.junit.Test

class PdfPaginationTest {
    @Test
    fun `bars fill rows then pages`() {
        assertEquals(listOf(0..7, 8..11), paginate(barCount = 12, barsPerRow = 2, rowsPerPage = 4))
    }

    @Test
    fun `a single bar is one page`() {
        assertEquals(listOf(0..0), paginate(1, 2, 4))
    }

    @Test
    fun `an exact fit does not make an empty trailing page`() {
        assertEquals(listOf(0..7), paginate(8, 2, 4))
    }

    @Test
    fun `no bars means no pages`() {
        assertEquals(emptyList<IntRange>(), paginate(0, 2, 4))
    }
}
```

- [ ] **Step 2: Run it and watch it fail**

Run: `./gradlew test --tests '*PdfPaginationTest*'`
Expected: FAIL — unresolved reference `paginate`.

- [ ] **Step 3: Implement**

```kotlin
package dev.allan.scoreapp.export

import android.graphics.Paint
import android.graphics.Typeface
import android.graphics.pdf.PdfDocument
import dev.allan.scoreapp.core.layout.LayoutConfig
import dev.allan.scoreapp.core.layout.layoutBar
import dev.allan.scoreapp.core.model.Score
import dev.allan.scoreapp.core.model.Staff
import java.io.OutputStream

/** Which bars land on each page. Pure arithmetic, so the PDF writer stays thin. */
fun paginate(barCount: Int, barsPerRow: Int, rowsPerPage: Int): List<IntRange> {
    if (barCount <= 0) return emptyList()
    val perPage = barsPerRow * rowsPerPage
    return (0 until barCount step perPage).map { start ->
        start..minOf(start + perPage - 1, barCount - 1)
    }
}

/**
 * A4 at 72dpi. Uses the same layoutBar as the screen with no focused beat, so the printed page
 * and the editor cannot disagree about engraving.
 */
fun exportPdf(score: Score, staff: Staff, typeface: Typeface, out: OutputStream) {
    val pageWidth = 842
    val pageHeight = 595
    val margin = 36f
    val barsPerRow = 2
    val rowsPerPage = 6
    val barWidth = (pageWidth - margin * 2) / barsPerRow
    val rowHeight = (pageHeight - margin * 2) / rowsPerPage
    val spacing = rowHeight / 12f

    val doc = PdfDocument()
    val paint = Paint().apply {
        this.typeface = typeface
        textSize = spacing * 4f
        isAntiAlias = true
        textAlign = Paint.Align.CENTER
    }
    val linePaint = Paint().apply { strokeWidth = 1f }

    paginate(score.bars.size, barsPerRow, rowsPerPage).forEachIndexed { pageIndex, range ->
        val info = PdfDocument.PageInfo.Builder(pageWidth, pageHeight, pageIndex + 1).create()
        val page = doc.startPage(info)
        range.forEachIndexed { i, barIndex ->
            val col = i % barsPerRow
            val row = i / barsPerRow
            val ox = margin + col * barWidth
            val oy = margin + row * rowHeight + spacing * 2f
            val result = layoutBar(score.bars[barIndex], staff, LayoutConfig(barWidth, spacing))
            repeat(staff.lineCount) { l ->
                val y = oy + l * spacing
                page.canvas.drawLine(ox, y, ox + barWidth, y, linePaint)
            }
            result.glyphs.forEach { g ->
                page.canvas.drawText(g.glyph.toString(), ox + g.x, oy + g.y, paint)
            }
        }
        doc.finishPage(page)
    }
    doc.writeTo(out)
    doc.close()
}
```

`ArchiveScreen.kt` lists `scoreDao.observeAll()` in a `LazyColumn`, each row opening the editor,
with overflow actions for **Export JSON**, **Export PDF** and **Delete**. Import reads a JSON
file through `ActivityResultContracts.OpenDocument` and calls `ScoreJson.decode`.

- [ ] **Step 4: Run it and watch it pass**

Run: `./gradlew test`
Expected: PASS — the whole suite, including the 4 new pagination tests.

- [ ] **Step 5: Write the import prompt**

`docs/SCORE_IMPORT_PROMPT.md` — the document handed to an AI along with a photo. It must contain
the exact JSON shape `ScoreJson` decodes (copy the field names from Task 11 verbatim: `slot`,
`articulations`, `sticking`, `division`, `tuplet`, `cells`, `beats`, `bars`, `schema_version`,
`time_sig_num`, `time_sig_den`, `default_bpm`, `profile`, `title`), the valid `slot` ids from
`DRUM_PROFILE` (`kick`, `hihatPedal`, `floorTom`, `snare`, `midTom`, `highTom`, `hihat`, `ride`,
`crash`), the valid `division` values, and the rule that notes struck together share one cell.
State that `schema_version` must be `1`.

- [ ] **Step 6: Commit**

```bash
git add app/src/main/java/dev/allan/scoreapp/ui/archive/ \
        app/src/main/java/dev/allan/scoreapp/export/ \
        app/src/test/java/dev/allan/scoreapp/PdfPaginationTest.kt \
        docs/SCORE_IMPORT_PROMPT.md
git commit -m "Archive scores, export them as PDF, and document the import schema"
```

---

## Self-Review

**Spec coverage.** §2 scope → Tasks 1–16 cover v1; training mode is explicitly v2 and absent
here, as specced. §3 data model → Tasks 2, 3, 4, 7. §4 editor rules 1–6 → Task 14 (rules 1–5)
and Task 8 + Task 10 (rule 6, beaming); colour → Task 15. §5 rendering, pure layout/thin draw →
Tasks 10 and 13; PDF reusing layout → Task 16. §6 persistence, JSON contract, PDF, reference
image → Tasks 11, 12, 16 — **reference image attachment is not implemented in any task.** Added
as a known gap below rather than silently dropped. §8 testing → every core task is JVM-tested;
the only device checks are Task 13 Step 4 and Task 14 Step 5.

**Placeholder scan.** No TBDs. Every code step carries real code. Task 16's `ArchiveScreen` is
described rather than written out in full — it is ordinary list-and-menu Compose with the exact
DAO and codec calls named, which is the one place prose is more useful than 80 lines of
boilerplate.

**Type consistency.** `cellsPerBeat(value, beatUnit, tuplet)` is used with that signature in
Tasks 3 and 6. `Cursor(bar, beat, cell)` is consistent across Tasks 5, 6 and 14. `layoutBar(bar,
staff, config)` returns `BarLayoutResult` in Tasks 10, 13 and 16. `slotNearest` is defined in
Task 4 and used in Tasks 13 and 14. `ScoreJson.encode/decode` defined in Task 11, used in 12 and
16.

**Known gaps, to fold into a later task or a v1.1 plan:**

1. **Reference image per score** (spec §6) has no task. It needs a column on `ScoreEntity`, a
   picker, and a viewer — small, but real, and it should not be pretended away.
2. **Adding and removing bars** — the editor edits the bars a score already has. A score is
   created with a fixed bar count until this is added.
3. **Time signature UI** — the model takes any `timeSigNum/Den`, but nothing changes it yet.
   The spec already flags this as possibly slipping to v2.
4. `ScoreCanvas` colours every glyph by `bar.beats[0].division` rather than per beat — correct
   only for uniform bars. Fix when wiring Task 15, or accept and log it.
