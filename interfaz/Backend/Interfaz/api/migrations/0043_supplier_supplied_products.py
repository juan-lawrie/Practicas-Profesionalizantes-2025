from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0042_cashregistersession_cashmovement_session'),
    ]

    operations = [
        migrations.AddField(
            model_name='supplier',
            name='supplied_products',
            field=models.ManyToManyField(blank=True, related_name='suppliers', to='api.product'),
        ),
    ]
