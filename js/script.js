$(document).ready(function() {
  const API_KEY = 'b22215ea558041eea2db1e04e6c5d44d';
  const RECIPES_TO_SHOW = 3;
  let requestCount = 0;
  const MAX_REQUESTS = 10;
  let searchOffset = 0;

  let ingredients = [];
  const $chipsInput = $('#ingredient-chips');
  const $ingredientInput = $('#ingredient-input');
  const $findBtn = $('#findRecipesBtn');
  const $results = $('#results');
  const $apiSelect = $('#apiSelect');
  const $spoonacularOption = $('#spoonacularOption');
  const $apiKeyHint = $('#apiKeyHint');

  if (!API_KEY) {
    $spoonacularOption.prop('disabled', true);
    $apiSelect.val('themealdb');
    $apiKeyHint.show();
  }

  function renderChips() {
    $chipsInput.find('.chip').remove();
    ingredients.forEach((ingredient, idx) => {
      const chip = $(`<span class="chip">${ingredient}<button class="chip-remove" aria-label="Remove ${ingredient}" tabindex="0">&times;</button></span>`);
      chip.find('.chip-remove').on('click keydown', function(e) {
        if (e.type === 'click' || (e.type === 'keydown' && (e.key === 'Enter' || e.key === ' '))) {
          ingredients.splice(idx, 1);
          renderChips();
          updateButtonState();
        }
      });
      chip.insertBefore($ingredientInput);
    });
  }

  function updateButtonState() {
    if (ingredients.length >= 1) {
      $findBtn.prop('disabled', false);
    } else {
      $findBtn.prop('disabled', true);
    }
  }

  $ingredientInput.on('keydown', function(e) {
    if (e.key === 'Enter' || e.key === ',' || e.key === 'Tab') {
      e.preventDefault();
      const value = $ingredientInput.val().trim();
      if (value && !ingredients.includes(value)) {
        ingredients.push(value);
        $ingredientInput.val('');
        renderChips();
        updateButtonState();
      }
    } else if (e.key === 'Backspace' && !$ingredientInput.val() && ingredients.length) {
      ingredients.pop();
      renderChips();
      updateButtonState();
    }
  });

  $ingredientInput.on('blur', function() {
    const value = $ingredientInput.val().trim();
    if (value && !ingredients.includes(value)) {
      ingredients.push(value);
      $ingredientInput.val('');
      renderChips();
      updateButtonState();
    }
  });

  function showLoading() {
    $findBtn.addClass('loading').prop('disabled', true);
    const loadingHTML = $('#loadingTemplate').html();
    $results.html(loadingHTML + loadingHTML + loadingHTML);
  }

  function showError() {
    $findBtn.removeClass('loading');
    const errorHTML = $('#errorTemplate').html();
    $results.html(errorHTML);
  }

  function displayRecipes(recipes, apiName, relaxed) {
    $findBtn.removeClass('loading');
    if (!recipes || recipes.length === 0) {
      $results.html(`
        <div class="alert alert-warning">
          <p>No vegan recipes found with these ingredients. Try fewer or more common ingredients.</p>
        </div>
      `);
      return;
    }
    const recipeHTML = recipes.slice(0, RECIPES_TO_SHOW).map(recipe => {
      const missingIngredients = recipe.missedIngredients
        ? recipe.missedIngredients.map(ing => ing.name).join(', ')
        : (recipe.ingredients ? recipe.ingredients.join(', ') : 'None');
      return `
        <div class="recipe-card">
          <img src="${recipe.image}" 
            alt="${recipe.title}"
            class="recipe-image"
            onerror="this.src='data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'100%25\' height=\'100%25\' viewBox=\'0 0 400 300\'%3E%3Crect width=\'400\' height=\'300\' fill=\'%23eee\'/%3E%3Ctext x=\'50%25\' y=\'50%25\' text-anchor=\'middle\' fill=\'%23999\' font-size=\'14\' font-family=\'sans-serif\'%3EImage not available%3C/text%3E%3C/svg%3E'">
          <div class="recipe-content">
            <h3 class="recipe-title">${recipe.title}</h3>
            <p class="recipe-ingredients">
              <strong>Includes:</strong> ${missingIngredients}
            </p>
            <a href="${recipe.sourceUrl}" 
              target="_blank"
              class="recipe-link">
              View Recipe →
            </a>
          </div>
        </div>
      `;
    }).join('');
    $results.html(`<div class="api-source">Vegan Recipes from <strong>${apiName}.</strong>${relaxed ? ' (relaxed match)' : ''}</div>` + recipeHTML);
    $('html, body').animate({ scrollTop: $results.offset().top - 30 }, 400);
  }

  function fetchSpoonacular() {
    showLoading();
    requestCount++;
    $.ajax({
      url: 'https://api.spoonacular.com/recipes/complexSearch',
      method: 'GET',
      data: {
        apiKey: API_KEY,
        includeIngredients: ingredients.join(','),
        number: RECIPES_TO_SHOW,
        offset: searchOffset,
        diet: 'vegan',
        ranking: 2,
        ignorePantry: true,
        addRecipeInformation: true,
        fillIngredients: true
      },
      success: function(response) {
        $findBtn.removeClass('loading');
        searchOffset += RECIPES_TO_SHOW;
        displayRecipes(response.results, 'Spoonacular');
      },
      error: function() {
        $findBtn.removeClass('loading');
        showError();
      }
    });
  }

  function fetchTheMealDB() {
    showLoading();
    $.ajax({
      url: 'https://www.themealdb.com/api/json/v1/1/filter.php?c=Vegetarian',
      method: 'GET',
      success: function(response) {
        const meals = response.meals || [];
        if (!meals.length) {
          displayRecipes([], 'TheMealDB', true);
          return;
        }
        // For each meal, fetch details to get ingredients
        const fetches = meals.slice(0, 24).map(meal =>
          $.getJSON('https://www.themealdb.com/api/json/v1/1/lookup.php?i=' + meal.idMeal)
        );
        Promise.all(fetches).then(detailsArr => {
          let filtered;
          if (ingredients.length === 0) {
            // Show all vegan meals if no ingredients entered
            filtered = detailsArr.map(d => d.meals[0]).map(meal => ({
              title: meal.strMeal,
              image: meal.strMealThumb,
              sourceUrl: meal.strSource || `https://www.themealdb.com/meal/${meal.idMeal}`,
              ingredients: Array.from({length: 20}, (_, i) => meal['strIngredient' + (i+1)]).filter(Boolean)
            }));
          } else {
            filtered = detailsArr.map(d => d.meals[0]).map(meal => {
              const mealIngredients = [];
              for (let i = 1; i <= 20; i++) {
                const ing = meal['strIngredient' + i];
                if (ing && ing.trim()) mealIngredients.push(ing.trim().toLowerCase());
              }
              const matchCount = ingredients.filter(userIng => mealIngredients.includes(userIng.toLowerCase())).length;
              return {
                title: meal.strMeal,
                image: meal.strMealThumb,
                sourceUrl: meal.strSource || `https://www.themealdb.com/meal/${meal.idMeal}`,
                ingredients: mealIngredients,
                matchCount
              };
            }).filter(meal => meal.matchCount > 0)
              .sort((a, b) => b.matchCount - a.matchCount);
          }
          displayRecipes(filtered, 'TheMealDB', true);
        }).catch(() => showError());
      },
      error: function() {
        showError();
      }
    });
  }

  $('#recipeForm').on('submit', function(e) {
    e.preventDefault();
    $results.empty();
    if (requestCount >= MAX_REQUESTS) {
      showError();
      return;
    }
    if (ingredients.length < 1) {
      $results.html(`
        <div class="alert alert-warning">
          <p>Please enter at least 1 ingredient.</p>
        </div>
      `);
      return;
    }
    const selectedApi = $apiSelect.val();
    if (selectedApi === 'spoonacular') {
      fetchSpoonacular();
    } else if (selectedApi === 'themealdb') {
      fetchTheMealDB();
    }
  });

  setInterval(function() {
    requestCount = 0;
  }, 60000);

  renderChips();
  updateButtonState();
});