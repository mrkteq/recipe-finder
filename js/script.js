$(document).ready(function() {
  const API_KEY = 'b22215ea558041eea2db1e04e6c5d44d';
  const RECIPES_TO_SHOW = 3;
  let requestCount = 0;
  const MAX_REQUESTS = 10; // Per minute limit for safety
  let searchOffset = 0;

  function showLoading() {
      const loadingHTML = $('#loadingTemplate').html();
      $('#results').html(loadingHTML + loadingHTML + loadingHTML);
  }

  function showError() {
      const errorHTML = $('#errorTemplate').html();
      $('#results').html(errorHTML);
  }

  function validateIngredients(ingredients) {
      const ingredientList = ingredients.split(',').map(i => i.trim()).filter(i => i);
      return ingredientList.length >= 2 ? ingredientList : null;
  }

  function displayRecipes(recipes) {
      if (!recipes || recipes.length === 0) {
          $('#results').html(`
              <div class="alert alert-warning">
                  <p>No vegan recipes found with these ingredients. Try different combinations!</p>
              </div>
          `);
          return;
      }

      const recipeHTML = recipes.slice(0, RECIPES_TO_SHOW).map(recipe => {
          const missingIngredients = recipe.missedIngredients
              ? recipe.missedIngredients.map(ing => ing.name).join(', ')
              : 'None';

          return `
              <div class="recipe-card">
                  <img src="${recipe.image}" 
                      alt="${recipe.title}"
                      class="recipe-image"
                      onerror="this.src='data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'100%25\' height=\'100%25\' viewBox=\'0 0 400 300\'%3E%3Crect width=\'400\' height=\'300\' fill=\'%23eee\'/%3E%3Ctext x=\'50%25\' y=\'50%25\' text-anchor=\'middle\' fill=\'%23999\' font-size=\'14\' font-family=\'sans-serif\'%3EImage not available%3C/text%3E%3C/svg%3E'">
                  <div class="recipe-content">
                      <h3 class="recipe-title">${recipe.title}</h3>
                      <p class="recipe-ingredients">
                          <strong>Requires:</strong> ${missingIngredients}
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

      $('#results').html(recipeHTML);
  }

  $('#recipeForm').on('submit', function(e) {
      e.preventDefault();
      
      // Clear previous results
      $('#results').empty();
      
      if (requestCount >= MAX_REQUESTS) {
          showError();
          return;
      }

      const ingredients = $('#ingredients').val();
      const validIngredients = validateIngredients(ingredients);

      if (!validIngredients) {
          $('#results').html(`
              <div class="alert alert-warning">
                  <p>Please enter at least 2 ingredients, separated by commas.</p>
              </div>
          `);
          return;
      }

      // Show loading state
      showLoading();
      requestCount++;

      $.ajax({
          url: 'https://api.spoonacular.com/recipes/complexSearch',
          method: 'GET',
          data: {
              apiKey: API_KEY,
              includeIngredients: validIngredients.join(','),
              number: RECIPES_TO_SHOW,
              offset: searchOffset,
              diet: 'vegan',
              ranking: 2,
              ignorePantry: true,
              addRecipeInformation: true,
              fillIngredients: true
          },
          success: function(response) {
              // Clear loading state
              $('#results').empty();
              
              // Increment offset for next search
              searchOffset += RECIPES_TO_SHOW;
              
              // Display the results
              displayRecipes(response.results);
          },
          error: function() {
              $('#results').empty();
              showError();
          }
      });
  });

  // Reset request count every minute
  setInterval(function() {
      requestCount = 0;
  }, 60000);
});