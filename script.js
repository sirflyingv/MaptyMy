'use strict';

const form = document.querySelector('.form');
const containerWorkouts = document.querySelector('.workouts');
const inputType = document.querySelector('.form__input--type');
const inputDistance = document.querySelector('.form__input--distance');
const inputDuration = document.querySelector('.form__input--duration');
const inputCadence = document.querySelector('.form__input--cadence');
const inputElevation = document.querySelector('.form__input--elevation');

// Sidebar for form cancel
const sidebar = document.querySelector('.sidebar');

// TOP PANEL
const topPanel = document.querySelector('.top__container');
const viewAllBtn = topPanel.querySelector('.view_all');
const clearAllBtn = topPanel.querySelector('.clear_all');
const sortBtn = topPanel.querySelector('.sort');
const lineBtn = topPanel.querySelector('.line');
const endLineBtn = topPanel.querySelector('.finish_line');

// Sort form
const sortForm = document.querySelector('.sort__form');
const runSortBtn = document.querySelector('.btn__sort');

// Modal stuff
const modal = document.querySelector('.modal');

/////////// OOP
class Workout {
  // new way, old browswer may fail
  date = new Date();
  id = (Date.now() + '').slice(-4);
  clicks = 0;

  constructor(coords, distance, duration) {
    // this.date = whatever  - old way
    // this.id = whatever   - old way
    this.coords = coords; // [lat, lng]
    this.distance = distance; // in km
    this.duration = duration; //  min
  }
  _setDescription() {
    // prettier-ignore
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    this.description = `${this.type[0].toUpperCase()}${this.type.slice(1)} on ${
      months[this.date.getMonth()]
    } ${this.date.getDate()}`;
  }
  click() {
    this.clicks++;
  }
}

class Running extends Workout {
  type = 'running';
  constructor(coords, distance, duration, cadence) {
    super(coords, distance, duration);
    this.cadence = cadence;
    this.calcPace();
    this._setDescription();
  }
  calcPace() {
    this.pace = this.duration / this.distance;
    return this.pace;
  }
}

class Cycling extends Workout {
  type = 'cycling';
  constructor(coords, distance, duration, elevationGain) {
    super(coords, distance, duration);
    this.elevationGain = elevationGain;
    this.calcSpeed();
    this._setDescription();
  }
  calcSpeed() {
    this.speed = this.distance / (this.duration / 60);
    return this.speed;
  }
}

const run1 = new Running([55.8, 37.3], 5.5, 24, 178);

const cycling1 = new Cycling([55.8, 37.4], 18.5, 54, 350);

// console.log(run1, cycling1);

///////////////////////////////////////////////////////
// APPLICATION ARCHITECTURE

class App {
  #map;
  #mapZoomLevel = 14;
  #mapEvent;
  #workouts = [];
  #markers = [];

  constructor() {
    // Get user's position
    this._getPosition();

    // Get data from local storage
    this._getLocalStorage();

    // Attach even handlers
    form.addEventListener('submit', this._newWorkout.bind(this));
    inputType.addEventListener('change', this._toggleElevationField);
    containerWorkouts.addEventListener('click', this._moveToPopup.bind(this));
    ////////////////////////////////////////////// MY EXPERIMENTS
    // start editing workout values handler
    containerWorkouts.addEventListener(
      'click',
      this._activateEditMode.bind(this)
    );
    // save or delete workout
    containerWorkouts.addEventListener('click', this._saveEdit.bind(this));
    containerWorkouts.addEventListener('click', this._deleteWorkout.bind(this));

    //  Hide form on click on sidebar
    sidebar.addEventListener('click', this._hideFormOnSidebar.bind(this));

    // TOP PANEL HANDLERS

    // Line buttons
    // lineBtn.addEventListener('click', this.drawLine.bind(this));
    // endLineBtn.addEventListener('click', this.saveLine.bind(this));

    // Sort button
    sortBtn.addEventListener('click', this._toggleSortForm);
    runSortBtn.addEventListener('click', this._sortWorkoutDisplay.bind(this));

    // View all button
    viewAllBtn.addEventListener('click', this._fitAllWorkouts.bind(this));

    // Clear All button
    clearAllBtn.addEventListener('click', this._dialogReset.bind(this));
    //////////////////////////////////////////////
  }

  _getPosition() {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        this._loadMap.bind(this),
        function () {
          alert('Could not get your position, go suck a dick');
        }
      );
    }
  }

  _loadMap(position) {
    const { latitude } = position.coords;
    const { longitude } = position.coords;

    const coords = [latitude, longitude];

    this.#map = L.map('map').setView(coords, this.#mapZoomLevel);
    // console.log(`https://www.google.pt/maps/@${latitude},${longitude}`);
    L.tileLayer('https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.fr/hot/copyright">OpenStreetMap</a> contributors',
    }).addTo(this.#map);

    // handling clicks on map
    this.#map.on('click', this._showForm.bind(this));

    this.#workouts.forEach(work => {
      this._renderWorkoutMarker(work);
    });
  }

  _showForm(mapE) {
    this.#mapEvent = mapE;
    form.classList.remove('hidden');
    inputDistance.focus();
  }

  _hideForm() {
    inputDistance.value =
      inputDuration.value =
      inputCadence.value =
      inputElevation.value =
        '';
    form.style.display = 'none';
    form.classList.add('hidden');
    setTimeout(() => (form.style.display = 'grid'), 1000);
  }

  // hide form when click on sidebar
  _hideFormOnSidebar(e) {
    if (e.target.closest('.form')) return;
    this._hideForm();
  }

  _toggleElevationField() {
    inputElevation.closest('.form__row').classList.toggle('form__row--hidden');
    inputCadence.closest('.form__row').classList.toggle('form__row--hidden');
  }

  _newWorkout(e) {
    const validInputs = (...inputs) =>
      inputs.every(inp => Number.isFinite(inp));
    const allPositive = (...inputs) => inputs.every(inp => inp > 0);

    e.preventDefault();

    // get data from the form
    const type = inputType.value;
    const distance = +inputDistance.value;
    const duration = +inputDuration.value;
    const { lat, lng } = this.#mapEvent.latlng;
    let workout;

    // check if data is valid

    // if workout is running - create running object
    if (type === 'running') {
      const cadence = +inputCadence.value;
      // check if data is valid
      if (
        // !Number.isFinite(distance) ||
        // !Number.isFinite(duration) ||
        // !Number.isFinite(cadence)
        !validInputs(distance, duration, cadence) ||
        !allPositive(distance, duration, cadence)
      )
        return alert('Inputs have to be positive numbers');

      workout = new Running([lat, lng], distance, duration, cadence);
    }

    // if workout is cycling - create cycling object
    if (type === 'cycling') {
      const elevation = +inputElevation.value;
      // check if data is valid
      if (
        !validInputs(distance, duration, elevation) ||
        !allPositive(distance, duration)
      )
        return alert('Inputs have to be positive numbers');
      workout = new Cycling([lat, lng], distance, duration, elevation);
    }

    // add new object to workout array
    this.#workouts.push(workout);

    // render workout on map as a marker
    this._renderWorkoutMarker(workout);

    // render workout in the list
    this._renderWorkout(workout);

    // hide the form clear input fields
    this._hideForm();

    // Set local storage to all workouts
    this._setLocalStorage();
  }

  _renderWorkoutMarker(workout) {
    // creating marker and storing it in variable
    const marker = L.marker(workout.coords, { draggable: false })
      .addTo(this.#map)
      .bindPopup(
        L.popup({
          maxWidth: 250,
          minWidth: 100,
          autoClose: false,
          closeOnClick: false,
          className: `${workout.type}-popup`,
          // ⬇ disables autPan on last added marker
          autoPan: false,
        })
      )
      .setPopupContent(
        ` ${workout.type === 'running' ? '🏃‍♂️' : '🚴‍♀️'} ${workout.description}`
      )
      .openPopup();

    // pushing marker variable to special array that is (I HOPE SO) parallel to workouts array so I can delete them at same time
    this.#markers.push(marker);

    // A way to make marker draggable. Later need to make markres draggable when workout editable
    // marker.dragging.enable();
  }
  _renderWorkout(workout) {
    let html = `
    <li class="workout workout--${workout.type}" data-id="${workout.id}">
    <h2 class="workout__title">${workout.description}</h2>
    <div class="btns__edit">
        <div class="btn__edit" title="Edit info">📝</div>
        <div class="btn__save hidden">🔄</div>
        <div class="btn__delete" title="Delete workout">❌</div>
    </div>
    
    <div class="workout__details">
      <span class="workout__icon">${
        workout.type === 'running' ? '🏃‍♂️' : '🚴‍♀️'
      }</span>
      <span class="workout__value" data-par_name="distance">${
        workout.distance
      }</span>
      <input class="form__input edit_value hidden" data-par_name="distance"/>
      <span class="workout__unit">km</span>
    </div>
    <div class="workout__details">
      <span class="workout__icon">⏱</span>
      <span class="workout__value" data-par_name="duration">${
        workout.duration
      }</span>
      <input class="form__input edit_value hidden" data-par_name="duration"/>
      <span class="workout__unit">min</span>
    </div>`;

    if (workout.type === 'running')
      html += `
      <div class="workout__details">
        <span class="workout__icon">⚡️</span>
        <span class="workout__value pace_number" >${workout.pace.toFixed(
          1
        )}</span>
        <span class="workout__unit">min/km</span>
      </div>
      <div class="workout__details">
        <span class="workout__icon">🦶🏼</span>
        <span class="workout__value">${workout.cadence}</span>
        <span class="workout__unit">spm</span>
      </div>
    </li>`;
    if (workout.type === 'cycling')
      html += `
          <div class="workout__details">
            <span class="workout__icon">⚡️</span>
            <span class="workout__value speed_number">${workout.speed.toFixed(
              1
            )}</span>
            <span class="workout__unit">km/h</span>
          </div>
          <div class="workout__details">
            <span class="workout__icon">⛰</span>
            <span class="workout__value">${workout.elevationGain}</span>
            <span class="workout__unit">m</span>
          </div>
        </li>`;
    form.insertAdjacentHTML('afterend', html);
  }

  // Sorting experiment

  _toggleSortForm(e) {
    sortForm.classList.toggle('hidden');
  }

  _sortWorkoutDisplay() {
    // making shallow copy of workout array
    const sortedWorkouts = [...this.#workouts];

    // getting sorting options from form
    const parameter = document.querySelector('.sort__par').value;
    const direction = document.querySelector('.sort__dir').value;

    // special variable to toggle sorting direction
    const director = direction === 'low_to_high' ? -1 : 1;

    // sorting
    sortedWorkouts.sort(function (a, b) {
      if (a[parameter] > b[parameter]) {
        return 1 * director;
      }
      if (a[parameter] < b[parameter]) {
        return -1 * director;
      }
    });

    // check
    this.showWorkouts();

    // delete woekout HTML elements
    const allWorkoutsEl = document.querySelectorAll('.workout');
    allWorkoutsEl.forEach(w => w.remove());

    // render HTML elements from sorted copy
    sortedWorkouts.forEach(work => {
      this._renderWorkout(work);
    });
  }

  // Delete workout HTML elements and recreate them from Local Storage
  _reloadWorkouts() {
    const allWorkoutsEl = document.querySelectorAll('.workout');
    allWorkoutsEl.forEach(w => w.remove());
    this._getLocalStorage();
  }

  _moveToPopup(e) {
    const workoutEl = e.target.closest('.workout');
    if (!workoutEl) return;
    const deleteBtn = workoutEl.querySelector('.btn__delete');
    const saveButton = e.target.closest('.btn__save');
    const editButton = workoutEl.querySelector('.btn__edit');
    if (
      e.target === deleteBtn ||
      e.target === saveButton ||
      e.target === editButton
    )
      return;
    const workout = this.#workouts.find(
      work => work.id === workoutEl.dataset.id
    );
    // console.log(workout);
    this.#map.setView(workout.coords, this.#mapZoomLevel, {
      animate: true,
      pan: {
        duration: 1,
      },
    });

    // using the public interface
    // workout.click();
  }

  ///////////////////////////////////////////////////////
  ///////////////////////////////////////////////////////
  ////////////////////////////////////////////// MY EXPERIMENTS

  // hide workout parameters HTML elements and show input fields
  _activateEditMode(e) {
    const workoutEl = e.target.closest('.workout');
    const editButton = e.target.closest('.btn__edit');
    if (!editButton) return;
    const saveButton = workoutEl.querySelector('.btn__save');

    editButton.classList.toggle('hidden');
    saveButton.classList.toggle('hidden');

    const values = workoutEl.querySelectorAll('.workout__value');
    const newInputFields = workoutEl.querySelectorAll('.edit_value');

    values.forEach(val => {
      if (!val.dataset.par_name) return;
      val.classList.toggle('hidden');
    });

    newInputFields.forEach(inp => {
      inp.classList.toggle('hidden');
      inp.value = inp.previousElementSibling.innerText;
    });

    // getting current workout object
    const workout = this.#workouts.find(
      work => work.id === workoutEl.dataset.id
    );

    // getting current workout marker and making it draggable
    const index = this.#workouts.indexOf(workout);
    this.#markers[index].dragging.enable();
  }

  // save new values of workout parameters to #workouts and toggle css hidden class for texts and inputs
  _saveEdit(e) {
    const workoutEl = e.target.closest('.workout');
    if (!workoutEl) return;
    const saveButton = e.target.closest('.btn__save');
    const editButton = workoutEl.querySelector('.btn__edit');
    const valuesEl = workoutEl.querySelectorAll('.workout__value');
    const newInputFields = workoutEl.querySelectorAll('.edit_value');
    if (!(e.target === workoutEl.querySelector('.btn__save'))) return;

    // input validation functions
    const validInputs = (...inputs) =>
      inputs.every(inp => Number.isFinite(inp));
    const allPositive = (...inputs) => inputs.every(inp => inp > 0);

    // getting core values
    const distance = +Array.from(newInputFields).find(
      val => val.dataset.par_name === 'distance'
    ).value;

    const duration = +Array.from(newInputFields).find(
      val => val.dataset.par_name === 'duration'
    ).value;

    // validationg valuers
    if (!validInputs(distance, duration) || !allPositive(distance, duration))
      return alert('Inputs have to be positive numbers');

    // setting values to text elements
    valuesEl.forEach(el => {
      if (!el.dataset.par_name) return;
      el.classList.toggle('hidden');
      el.innerText = el.nextElementSibling.value;
      el.nextElementSibling.classList.toggle('hidden');
    });

    // trying to update array of objects
    const workout = this.#workouts.find(
      work => work.id === workoutEl.dataset.id
    );

    // saving marker position to workout object and disabling dragging
    const index = this.#workouts.indexOf(workout);
    workout.coords[0] = this.#markers[index]._latlng.lat;
    workout.coords[1] = this.#markers[index]._latlng.lng;
    this.#markers[index].dragging.disable();
    this.#markers[index].openPopup();

    workout.distance = distance;
    workout.duration = duration;
    // (DONE) NEED TO IMPLEMENT REBUILDING Running and Cycling OBJECTS to update Pace or Speed DONE

    if (workout.type === 'running') {
      workout.calcPace();
      workoutEl.querySelector('.pace_number').innerText =
        workout.pace.toFixed(1);
    } else if (workout.type === 'cycling') {
      workout.calcSpeed();
      workoutEl.querySelector('.speed_number').innerText =
        workout.speed.toFixed(1);
    }

    editButton.classList.toggle('hidden');
    saveButton.classList.toggle('hidden');

    this._setLocalStorage();
  }

  _dialogDeleteWorkout(e) {
    this._createModal('Are you sure????', 'YEP', 'NOPE');
    const modalContent = document.querySelector('.modal-content');
    const yesBtn = modalContent.querySelector('.btn__confirm');
    const noBtn = modalContent.querySelector('.btn__cancel');

    yesBtn.addEventListener('click', this._deleteWorkout(e));
    noBtn.addEventListener('click', function () {
      modal.classList.add('hidden');
      modalContent.remove();
    });
  }
  // Deleting  workout
  _deleteWorkout(e) {
    if (e.target.closest('.form')) return;
    if (e.target === document.querySelector('.workouts')) return;
    const workoutEl = e.target.closest('.workout');
    const deleteBtn = workoutEl.querySelector('.btn__delete');
    if (e.target != deleteBtn) return;

    const workout = this.#workouts.find(
      work => work.id === workoutEl.dataset.id
    );

    this._createModal('Are you sure????', 'YEP', 'NOPE');
    const modalContent = document.querySelector('.modal-content');
    const yesBtn = modalContent.querySelector('.btn__confirm');
    const noBtn = modalContent.querySelector('.btn__cancel');

    const InnerDeleteWorkout = function () {
      workoutEl.remove();
      const arrayIndexToDelete = this.#workouts.indexOf(workout);
      this.#workouts.splice(arrayIndexToDelete, 1);
      this.#map.removeLayer(this.#markers[arrayIndexToDelete]);
      // saving the changed array
      this._setLocalStorage();

      modal.classList.add('hidden');
      modalContent.remove();
    };

    yesBtn.addEventListener('click', InnerDeleteWorkout.bind(this));
    noBtn.addEventListener('click', function () {
      modal.classList.add('hidden');
      modalContent.remove();
    });
  }

  // function for creating modal windows with 2 buttons and various texts
  _createModal(mainText, btnYes = 'OK', btnNo = 'Cancel') {
    //adding adjacent HTML
    const html = `
    <div class="modal-content">
    ${mainText}
    <button class="btn__confirm">${btnYes}</button>
    <button class="btn__cancel">${btnNo}</button>
    </div>
    `;

    modal.classList.remove('hidden');
    modal.insertAdjacentHTML('afterbegin', html);
  }

  ///////////////////////////////////////////////////////
  ///////////////////////////////////////////////////////
  ///////////////////////////////////////////////////////
  _setLocalStorage() {
    localStorage.setItem('workouts', JSON.stringify(this.#workouts));
  }

  _getLocalStorage() {
    let workout;
    const data = JSON.parse(localStorage.getItem('workouts'));

    if (!data) return;
    this.#workouts = [];
    // this.#workouts = data; // - old way, just adding objects form data, without inheritance
    const mainW = this.#workouts; // trying new way

    ///////////////////////////////////////////////////////
    //////////////////////////////////////// MY EXPERIMENTS
    data.forEach(w => {
      // console.log('fetched data', w);

      if (w.type === 'running') {
        workout = new Running(w.coords, w.distance, w.duration, w.cadence);
        workout.clicks = w.clicks;
        workout.date = w.date;
        workout.description = w.description;
        workout.id = w.id;
      }
      if (w.type === 'cycling') {
        workout = new Cycling(
          w.coords,
          w.distance,
          w.duration,
          w.elevationGain
        );

        workout.clicks = w.clicks;
        workout.date = w.date;
        workout.description = w.description;
        workout.id = w.id;
      }

      mainW.push(workout);
    });
    ///////////////////////////////////////////////////////
    ///////////////////////////////////////////////////////

    this.#workouts.forEach(work => {
      this._renderWorkout(work);
    });
  }

  // Delete all data
  _reset() {
    localStorage.removeItem('workouts');
    location.reload();
  }

  // Reset confirmation dialog
  _dialogReset() {
    // implementation of confirm modal
    this._createModal('Are you sure????', 'YEP', 'NOPE');
    const modalContent = document.querySelector('.modal-content');
    const yesBtn = modalContent.querySelector('.btn__confirm');
    const noBtn = modalContent.querySelector('.btn__cancel');

    yesBtn.addEventListener('click', this._reset.bind(this));
    noBtn.addEventListener('click', function () {
      modal.classList.add('hidden');
      modalContent.remove();
    });
  }

  // Set view to fit all workouts
  _fitAllWorkouts() {
    if (this.#workouts.length === 0) return;

    const latArr = [];
    const lonArr = [];

    this.#workouts.forEach(function (w) {
      latArr.push(w.coords[0]);
      lonArr.push(w.coords[1]);
    });
    const latMax = Math.max(...latArr);
    const latMin = Math.min(...latArr);
    const lonMax = Math.max(...lonArr);
    const lonMin = Math.min(...lonArr);

    this.#map.fitBounds(
      [
        [latMax, lonMax],
        [latMin, lonMin],
      ],
      { padding: [100, 100] }
    );
  }

  plsShowMapObject() {
    console.log(this.#map._layers);
    // this.#map._layers[66].options.draggable = true;
    // console.log(this.#map._layers[66]);
  }

  showWorkouts() {
    console.log(this.#workouts);
    // console.log(this.#markers);
  }

  // drawLine(e) {
  //   lineBtn.classList.toggle('hidden');
  //   endLineBtn.classList.toggle('hidden');

  //   let latlngs = [];
  //   // console.log(e);
  //   this.#map.on(
  //     'click',
  //     function (mapE) {
  //       latlngs.push([mapE.latlng.lat, mapE.latlng.lng]);
  //       // let line = L.polyline(latlngs).addTo(this.#map);
  //       console.log(latlngs);
  //     }.bind(this)
  //   );

  //   lineBtn.addEventListener(
  //     'click',
  //     function () {
  //       let line = L.polyline(latlngs).addTo(this.#map);
  //       lineBtn.style.backgroundColor = 'var(--color-dark--2)';
  //     }.bind(this)
  //   );
  // }

  // saveLine() {
  //   lineBtn.classList.toggle('hidden');
  //   endLineBtn.classList.toggle('hidden');
  //   console.log('kekw');
  // }
}

const app = new App();

///////// recalling sorting
// const arr = [2, 33, 6, 23, 5];

// const arro = [{ kek: 5 }, { kek: 4 }, { kek: 7 }];

// const sortLowToHigh = function (arr) {
//   arr.sort(function (a, b) {
//     return a - b;
//   });
//   return arr;
// };

// const sortLowToHighOnProp = function (arr) {
//   arr.sort(function (a, b) {
//     if (a.kek > b.kek) {
//       return 1;
//     }
//     if (a.kek < b.kek) {
//       return -1;
//     }
//   });
//   return arr;
// };

// const sortHighToLow = function (arr) {
//   arr.sort(function (a, b) {
//     return a - b;
//   });
//   return arr;
// };

// console.log(sortLowToHighOnProp(arro));

// console.log(sortLowToHigh(arr));

// console.log(arr);
