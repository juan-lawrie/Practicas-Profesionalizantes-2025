# Generated manually for role migration - Part 2
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0004_create_roles_and_temp_field'),
    ]

    operations = [
        # Eliminar el campo role original (CharField)
        migrations.RemoveField(
            model_name='user',
            name='role',
        ),
        # Renombrar role_new a role
        migrations.RenameField(
            model_name='user',
            old_name='role_new',
            new_name='role',
        ),
    ]
