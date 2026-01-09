# Generated manually to fix pending rename and add recipe decimal places

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0035_production_productionitem'),
    ]

    operations = [
        # Cambiar RecipeIngredient.quantity a 3 decimales
        migrations.AlterField(
            model_name='recipeingredient',
            name='quantity',
            field=models.DecimalField(decimal_places=3, max_digits=10),
        ),
    ]
